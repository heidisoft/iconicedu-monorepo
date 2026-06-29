import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  Share,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FileText,
  Bookmark,
  Users,
  Image as ImageIcon,
  Download,
  File,
  MessageCircle,
  Share2,
  Video,
  X,
} from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import type {
  ChannelUiTabKeyVM,
  MessageVM,
  TextMessageVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import { ChannelTopicIconBadge } from '@/lib/learning-space-icons';
import { RoleNameIndicator } from '@/components/profile/role-name-indicator';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import {
  ensureDirectMessageChannelForProfiles,
  fetchChannelMembers,
  queryKeys,
} from '@/lib/api/queries';
import { profileAvatarColors, profileAvatarBg } from '@/lib/profile-avatar-colors';
import { BottomSheet } from '@iconicedu/ui-native';

const CHANNEL_FILES_BUCKET = 'channel-files';

// ─── Screen dimensions ─────────────────────────────────────────────────────────
const PARTIAL_HEIGHT_RATIO = 0.58;
const JOIN_AFTER_CLOSE_DELAY_MS = 260;
const PARTIAL_OVERLAY_TOP_INSET = 190;

// ─── Avatar helpers ────────────────────────────────────────────────────────────

function avatarColor(seed: string, themeKey?: string | null): string {
  return profileAvatarBg(seed, themeKey);
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return name[0]?.toUpperCase() ?? '?';
}

function isExternalJoinHref(joinHref?: string | null): boolean {
  return Boolean(joinHref && /^https?:\/\//i.test(joinHref));
}

function resolveExternalJoinProviderLabel(joinHref?: string | null) {
  if (!joinHref || !isExternalJoinHref(joinHref)) {
    return null;
  }

  try {
    const hostname = new URL(joinHref).hostname.toLowerCase();
    if (hostname.includes('zoom')) return 'Zoom';
    if (hostname.includes('jitsi')) return 'Jitsi';
    if (hostname.includes('meet.google')) return 'Google Meet';
    if (hostname.includes('teams.microsoft')) return 'Microsoft Teams';
  } catch {
    return null;
  }

  return null;
}

function themeAvatarColor(
  themeKey?: string | null,
  fallbackBg?: string,
  fallbackFg?: string,
): { bg: string; fg: string } {
  if (themeKey) {
    return profileAvatarColors({
      seed: themeKey,
      themeKey,
      fallbackFg: fallbackFg || '#0f172a',
    });
  }
  return {
    bg: fallbackBg || '#f8fafc',
    fg: fallbackFg || '#0f172a',
  };
}

// ─── Sender name helper ────────────────────────────────────────────────────────

function getSenderName(sender: UserProfileVM): string {
  return (
    sender.profile.displayName?.trim() || sender.profile.firstName?.trim() || 'Unknown'
  );
}

// ─── Data extraction helpers ───────────────────────────────────────────────────

type FileItem = {
  id: string;
  name: string;
  url: string;
  storagePath?: string;
  mimeType?: string;
  size?: number;
  createdAt: string;
  kind: 'image' | 'file';
};

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function getMessagePreview(msg: MessageVM): string {
  switch (msg.core.type) {
    case 'text':
      return (msg as TextMessageVM).content.text.slice(0, 120);
    case 'image':
      return 'Photo';
    case 'file':
      return (msg as unknown as { attachment: { name: string } }).attachment.name;
    case 'audio-recording':
      return 'Voice message';
    default:
      return 'Message';
  }
}

function extractSaved(messages: MessageVM[]): Array<{
  id: string;
  senderName: string;
  senderRole?: string | null;
  senderThemeKey?: string | null;
  preview: string;
  createdAt: string;
}> {
  return messages
    .filter((m) => m.state?.isSaved)
    .map((m) => ({
      id: m.ids.id,
      senderName: getSenderName(m.core.sender),
      senderRole: m.core.sender.kind,
      senderThemeKey: m.core.sender.ui?.themeKey ?? null,
      preview: getMessagePreview(m),
      createdAt: m.core.createdAt,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function extractMembers(
  messages: MessageVM[],
  extraMembers?: Array<{
    id: string;
    name: string;
    avatarSeed?: string | null;
    themeKey?: string | null;
    role?: string | null;
    profile?: UserProfileVM | null;
  }> | null,
): Array<{
  id: string;
  name: string;
  seed: string;
  role?: string | null;
  themeKey?: string | null;
  profile?: UserProfileVM | null;
}> {
  const map = new Map<
    string,
    {
      id: string;
      name: string;
      seed: string;
      role?: string | null;
      themeKey?: string | null;
      profile?: UserProfileVM | null;
    }
  >();
  for (const msg of messages) {
    const s = msg.core.sender;
    if (!map.has(s.ids.id)) {
      const name = getSenderName(s);
      map.set(s.ids.id, {
        id: s.ids.id,
        name,
        seed: name,
        role: s.kind,
        themeKey: s.ui?.themeKey ?? null,
        profile: s,
      });
    }
  }
  if (extraMembers) {
    for (const m of extraMembers) {
      if (!map.has(m.id)) {
        map.set(m.id, {
          id: m.id,
          name: m.name,
          seed: m.avatarSeed ?? m.name,
          role: m.role,
          themeKey: m.themeKey ?? m.profile?.ui?.themeKey ?? null,
          profile: m.profile ?? null,
        });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeMemberProfileKind(value?: string | null): UserProfileVM['kind'] {
  if (
    value === 'educator' ||
    value === 'guardian' ||
    value === 'child' ||
    value === 'staff' ||
    value === 'system'
  ) {
    return value;
  }
  return 'staff';
}

function buildMemberProfile(input: {
  id: string;
  orgId: string;
  accountId?: string | null;
  name: string;
  avatarSeed?: string | null;
  themeKey?: string | null;
  role?: string | null;
  bio?: string | null;
  email?: string | null;
  timezone?: string | null;
}): UserProfileVM {
  const now = new Date(0).toISOString();
  return {
    ids: {
      id: input.id,
      orgId: input.orgId,
      accountId: input.accountId || input.id,
    },
    kind: normalizeMemberProfileKind(input.role),
    profile: {
      displayName: input.name,
      firstName: null,
      lastName: null,
      bio: input.bio ?? null,
      email: input.email ?? null,
      avatar: { source: 'seed', seed: input.avatarSeed ?? input.id, url: null },
    },
    prefs: { timezone: input.timezone ?? null },
    ui: { themeKey: input.themeKey ?? null },
    meta: { createdAt: now, updatedAt: now },
  } as UserProfileVM;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type ChannelTab = 'files' | 'saved' | 'members';

type ParsedMobileChannelUiDefaults = {
  disabledTabs: ChannelUiTabKeyVM[];
};

export type ChannelInfoSheetProps = {
  visible: boolean;
  channelId?: string;
  title: string;
  subtitle?: string | null;
  kind: 'dm' | 'channel' | 'space';
  avatarSeed?: string | null;
  avatarThemeKey?: string | null;
  avatarRole?: string | null;
  iconKey?: string | null;
  themeKey?: string | null;
  memberCount?: number | null;
  description?: string | null;
  members?: Array<{
    id: string;
    name: string;
    avatarSeed?: string | null;
    themeKey?: string | null;
    role?: string | null;
  }> | null;
  messages?: MessageVM[];
  liveJoinUrl?: string | null;
  onJoinPress?: () => void;
  onClose: () => void;
  onProfilePress?: (user: UserProfileVM) => void;
};

// ─── Tab definitions ───────────────────────────────────────────────────────────

const TABS: Array<{ key: ChannelTab; label: string }> = [
  { key: 'files', label: 'Files' },
  { key: 'saved', label: 'Saved' },
  { key: 'members', label: 'Members' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseChannelUiDefaults(value: unknown): ParsedMobileChannelUiDefaults {
  if (!isRecord(value)) {
    return { disabledTabs: [] };
  }

  const disabledTabs = Array.isArray(value.disabledTabs)
    ? value.disabledTabs.filter(
        (tab): tab is ChannelUiTabKeyVM =>
          tab === 'messages' ||
          tab === 'files' ||
          tab === 'schedule' ||
          tab === 'saved' ||
          tab === 'members',
      )
    : [];

  return {
    disabledTabs: Array.from(new Set(disabledTabs)),
  };
}

export function getVisibleChannelInfoTabs(input?: ParsedMobileChannelUiDefaults | null) {
  const disabledTabs = new Set(input?.disabledTabs ?? []);
  return TABS.filter((tab) => !disabledTabs.has(tab.key));
}

// ─── Tab icon renderer ─────────────────────────────────────────────────────────

function TabIcon({ tabKey, color }: { tabKey: ChannelTab; color: string }) {
  const size = 16;
  if (tabKey === 'files') return <FileText size={size} color={color} />;
  if (tabKey === 'saved') return <Bookmark size={size} color={color} />;
  return <Users size={size} color={color} />;
}

function EmptyTabState({
  icon,
  title,
  description,
  colors,
  s,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  colors: AppColors;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={s.emptyState}>
      <View style={[s.emptyIconBadge, { backgroundColor: colors.inputBg }]}>{icon}</View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptySubtitle}>{description}</Text>
    </View>
  );
}

// ─── File item row (images + documents) ────────────────────────────────────────

function FileItemRow({
  item,
  colors,
  s,
}: {
  item: FileItem;
  colors: AppColors;
  s: ReturnType<typeof makeStyles>;
}) {
  const [opening, setOpening] = useState(false);
  const isImage = item.kind === 'image';

  const handleOpen = useCallback(async () => {
    if (opening) return;
    setOpening(true);
    try {
      let openUrl = item.url;
      if (item.storagePath) {
        const { data, error } = await supabase.storage
          .from(CHANNEL_FILES_BUCKET)
          .createSignedUrl(item.storagePath, 300);
        if (!error && data?.signedUrl) openUrl = data.signedUrl;
      }

      await WebBrowser.openBrowserAsync(openUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
    } catch {
      await Linking.openURL(item.url).catch(() => null);
    } finally {
      setOpening(false);
    }
  }, [item, opening]);

  const iconBg = isImage ? colors.tealBg : colors.card;
  const iconColor = isImage ? colors.teal : colors.text;

  const meta: string[] = [];
  if (item.mimeType) meta.push(item.mimeType.split('/').pop() ?? item.mimeType);
  if (item.size) meta.push(formatFileSize(item.size));
  meta.push(formatRelativeDate(item.createdAt));

  return (
    <TouchableOpacity style={s.fileItem} onPress={handleOpen} activeOpacity={0.7}>
      <View style={[s.fileIconBox, { backgroundColor: iconBg }]}>
        {isImage ? (
          <ImageIcon size={20} color={iconColor} />
        ) : (
          <File size={20} color={iconColor} />
        )}
      </View>
      <View style={s.fileInfo}>
        <Text style={s.fileName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={s.fileMeta} numberOfLines={1}>
          {meta.filter(Boolean).join(' • ')}
        </Text>
      </View>
      {opening ? (
        <ActivityIndicator size="small" color={colors.textMuted} />
      ) : (
        <Download size={16} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

// ─── Tab content ───────────────────────────────────────────────────────────────

type TabContentProps = {
  activeTab: ChannelTab;
  fileItems: FileItem[];
  filesLoading: boolean;
  membersLoading: boolean;
  savedItems: Array<{
    id: string;
    senderName: string;
    senderRole?: string | null;
    senderThemeKey?: string | null;
    preview: string;
    createdAt: string;
  }>;
  memberItems: Array<{
    id: string;
    name: string;
    seed: string;
    role?: string | null;
    themeKey?: string | null;
    profile?: UserProfileVM | null;
  }>;
  colors: AppColors;
  s: ReturnType<typeof makeStyles>;
  memberCount?: number | null;
  isFullScreen: boolean;
  currentProfileId?: string | null;
  onMemberMessage?: (memberId: string, memberName: string) => void;
  onProfilePress?: (user: UserProfileVM) => void;
};

function TabContent({
  activeTab,
  fileItems,
  filesLoading,
  membersLoading,
  savedItems,
  memberItems,
  colors,
  s,
  memberCount,
  isFullScreen,
  currentProfileId,
  onMemberMessage,
  onProfilePress,
}: TabContentProps) {
  if (activeTab === 'files') {
    if (filesLoading) {
      return (
        <View style={s.emptyState}>
          <ActivityIndicator size="large" color={colors.teal} />
        </View>
      );
    }
    if (fileItems.length === 0) {
      return (
        <EmptyTabState
          icon={<FileText size={22} color={colors.textMuted} />}
          title="No shared files"
          description="Files shared in this channel will appear here."
          colors={colors}
          s={s}
        />
      );
    }
    return (
      <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={isFullScreen}>
        {fileItems.map((item) => (
          <FileItemRow key={item.id} item={item} colors={colors} s={s} />
        ))}
      </ScrollView>
    );
  }

  if (activeTab === 'saved') {
    if (savedItems.length === 0) {
      return (
        <EmptyTabState
          icon={<Bookmark size={22} color={colors.textMuted} />}
          title="No saved messages"
          description="Save important messages by clicking the bookmark icon"
          colors={colors}
          s={s}
        />
      );
    }
    return (
      <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={isFullScreen}>
        {savedItems.map((item) => {
          const avatarColors = profileAvatarColors({
            seed: item.senderName,
            themeKey: item.senderThemeKey,
          });
          return (
            <View key={item.id} style={s.savedItem}>
              <View style={{ width: 40, height: 40, position: 'relative' }}>
                <View style={[s.savedAvatar, { backgroundColor: avatarColors.bg }]}>
                  <Text style={[s.savedAvatarTxt, { color: avatarColors.fg }]}>
                    {getInitials(item.senderName)}
                  </Text>
                </View>
              </View>
              <View style={s.savedBody}>
                <View style={s.savedSenderRow}>
                  <RoleNameIndicator
                    name={item.senderName}
                    role={item.senderRole}
                    textStyle={s.savedSenderName}
                    iconSize={12}
                  />
                  <Text style={s.savedDate}>{formatRelativeDate(item.createdAt)}</Text>
                </View>
                <Text style={s.savedPreview} numberOfLines={2}>
                  {item.preview}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  }

  // Members tab
  const displayCount = memberItems.length > 0 ? memberItems.length : (memberCount ?? 0);
  if (membersLoading) {
    return (
      <View style={s.emptyState}>
        <ActivityIndicator size="large" color={colors.teal} />
      </View>
    );
  }
  if (memberItems.length === 0) {
    return (
      <View style={s.emptyState}>
        <Users size={44} color={colors.textMuted} style={{ opacity: 0.4 }} />
        <Text style={s.emptyTitle}>No members yet</Text>
      </View>
    );
  }
  return (
    <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={isFullScreen}>
      <View style={s.membersHeader}>
        <Text style={s.membersCount}>
          {displayCount} member{displayCount !== 1 ? 's' : ''}
        </Text>
      </View>
      {memberItems.map((member) => (
        <View key={member.id} style={s.memberRow}>
          <TouchableOpacity
            style={{ width: 36, height: 36, position: 'relative' }}
            onPress={() => {
              if (member.profile) {
                onProfilePress?.(member.profile);
              }
            }}
            disabled={!member.profile || !onProfilePress}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Open ${member.name} profile`}
          >
            <View
              style={[
                s.memberAvatar,
                { backgroundColor: avatarColor(member.seed, member.themeKey) },
              ]}
            >
              <Text
                style={[
                  s.memberAvatarTxt,
                  {
                    color: profileAvatarColors({
                      seed: member.seed,
                      themeKey: member.themeKey,
                    }).fg,
                  },
                ]}
              >
                {getInitials(member.name)}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.memberInfo}
            onPress={() => {
              if (member.profile) {
                onProfilePress?.(member.profile);
              }
            }}
            disabled={!member.profile || !onProfilePress}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Open ${member.name} profile`}
          >
            <RoleNameIndicator
              name={member.name}
              role={member.role}
              textStyle={s.memberName}
              iconSize={12}
            />
          </TouchableOpacity>
          {currentProfileId && member.id === currentProfileId ? (
            <View style={s.memberSelfBadge}>
              <Text style={s.memberSelfBadgeText}>You</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={s.memberActionBtn}
              onPress={() => onMemberMessage?.(member.id, member.name)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Message ${member.name}`}
            >
              <MessageCircle size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  const hairline = StyleSheet.hairlineWidth;
  return StyleSheet.create({
    sheet: {
      backgroundColor: C.bg,
    },

    // ── Header ────────────────────────────────────────────────────────────────
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: hairline,
      borderBottomColor: C.border,
    },
    headerTitle: {
      flex: 1,
      fontSize: 19,
      fontWeight: '600',
      color: C.text,
    },
    closeIconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.inputBg,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Hero section (DM: large; channel/space: compact) ──────────────────────
    hero: {
      alignItems: 'center',
      paddingVertical: 20,
      paddingHorizontal: 24,
      gap: 10,
    },
    heroCompact: {
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 24,
      gap: 8,
      borderBottomWidth: hairline,
      borderBottomColor: C.border,
    },
    avatarCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarCircleCompact: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarTxt: { color: '#fff', fontWeight: '700', fontSize: 30 },
    avatarTxtCompact: { color: '#fff', fontWeight: '700', fontSize: 24 },
    iconBox: {
      width: 72,
      height: 72,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBoxCompact: {
      width: 56,
      height: 56,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroName: { fontSize: 24, fontWeight: '700', color: C.text, textAlign: 'center' },
    heroNameCompact: {
      fontSize: 20,
      fontWeight: '700',
      color: C.text,
      textAlign: 'center',
    },
    heroSub: { fontSize: 15, color: C.textMuted, textAlign: 'center' },
    heroJoinButton: {
      marginTop: 4,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      borderRadius: 20,
      backgroundColor: C.tealBg,
      borderWidth: hairline,
      borderColor: C.teal,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    heroJoinButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: C.teal,
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      backgroundColor: 'rgba(15, 23, 42, 0.42)',
    },
    modalCard: {
      gap: 16,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      padding: 20,
    },
    modalHeading: { gap: 8 },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: C.text,
    },
    modalDescription: {
      fontSize: 15,
      lineHeight: 20,
      color: C.textMuted,
    },
    modalLinkBox: {
      gap: 6,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.inputBg,
      padding: 14,
    },
    modalLinkLabel: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: C.textMuted,
    },
    modalLinkValue: {
      fontSize: 14,
      lineHeight: 19,
      color: C.text,
    },
    modalFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: 10,
    },
    modalButton: {
      minWidth: 104,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    modalButtonSecondary: {
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.inputBg,
    },
    modalButtonPrimary: {
      backgroundColor: C.teal,
    },
    modalButtonSecondaryText: {
      fontSize: 15,
      fontWeight: '600',
      color: C.text,
    },
    modalButtonPrimaryText: {
      fontSize: 15,
      fontWeight: '700',
      color: C.tealFg,
    },
    modalCloseIconButton: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 21,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.inputBg,
    },

    // ── Info rows (DM only) ───────────────────────────────────────────────────
    section: {
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 12,
      backgroundColor: C.card,
      borderWidth: hairline,
      borderColor: C.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    rowSep: {
      height: hairline,
      backgroundColor: C.border,
      marginLeft: 16,
    },
    rowIcon: { fontSize: 20, width: 24, textAlign: 'center' },
    rowLabel: { flex: 1, fontSize: 15, color: C.textMuted },
    rowValue: {
      fontSize: 15,
      fontWeight: '600',
      color: C.text,
      maxWidth: 200,
      textAlign: 'right',
    },

    // ── Tab bar ───────────────────────────────────────────────────────────────
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: hairline,
      borderBottomColor: C.border,
      backgroundColor: C.bg,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      gap: 4,
      borderBottomWidth: 2.5,
      borderBottomColor: 'transparent',
    },
    tabItemActive: {
      borderBottomColor: C.teal,
    },
    tabLabel: {
      fontSize: 12,
      color: C.textMuted,
      fontWeight: '500',
    },
    tabLabelActive: {
      color: C.teal,
    },

    // ── Empty state ───────────────────────────────────────────────────────────
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      gap: 8,
      paddingBottom: 60,
    },
    emptyIconBadge: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: C.text,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: C.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },

    // ── Files tab ─────────────────────────────────────────────────────────────
    fileItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: hairline,
      borderBottomColor: C.border,
    },
    fileIconBox: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fileInfo: {
      flex: 1,
      gap: 2,
    },
    fileName: {
      fontSize: 15,
      fontWeight: '600',
      color: C.text,
    },
    fileMeta: {
      fontSize: 13,
      color: C.textMuted,
    },
    fileDownloadBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.inputBg,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Saved tab ─────────────────────────────────────────────────────────────
    savedItem: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: hairline,
      borderBottomColor: C.border,
    },
    savedAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    savedAvatarTxt: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },
    savedBody: {
      flex: 1,
    },
    savedSenderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    savedSenderName: {
      fontSize: 15,
      fontWeight: '600',
      color: C.text,
    },
    savedDate: {
      fontSize: 12,
      color: C.textMuted,
    },
    savedPreview: {
      fontSize: 14,
      color: C.textMuted,
      lineHeight: 19,
    },

    // ── Members tab ───────────────────────────────────────────────────────────
    membersHeader: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: hairline,
      borderBottomColor: C.border,
    },
    membersCount: {
      fontSize: 14,
      fontWeight: '600',
      color: C.textMuted,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: hairline,
      borderBottomColor: C.border,
    },
    memberAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberAvatarTxt: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 16,
    },
    memberName: {
      fontSize: 16,
      color: C.text,
    },
    memberInfo: {
      flex: 1,
      minWidth: 0,
    },
    memberActionBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.inputBg,
      borderWidth: hairline,
      borderColor: C.border,
    },
    memberSelfBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: C.inputBg,
      borderWidth: hairline,
      borderColor: C.border,
    },
    memberSelfBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: C.textMuted,
    },
  });
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ChannelInfoSheet({
  visible,
  channelId,
  title,
  subtitle,
  kind,
  avatarSeed,
  avatarThemeKey,
  avatarRole,
  iconKey,
  themeKey,
  memberCount,
  description,
  members,
  messages = [],
  liveJoinUrl,
  onJoinPress,
  onClose,
  onProfilePress,
}: ChannelInfoSheetProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const orgId = account?.org_id ?? '';
  const currentProfileId =
    ((profile as Record<string, unknown> | undefined)?.id as string | undefined) ?? '';

  const [activeTab, setActiveTab] = useState<ChannelTab>('files');
  const [channelUiDefaults, setChannelUiDefaults] =
    useState<ParsedMobileChannelUiDefaults | null>(null);
  const [externalJoinTarget, setExternalJoinTarget] = useState<{
    joinHref: string;
    providerLabel: string | null;
  } | null>(null);
  const joinTransitionTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const isDm = kind === 'dm';
  const seed = avatarSeed ?? title;
  const heroAvatarColors = profileAvatarColors({ seed, themeKey: avatarThemeKey });
  const typeLabel = isDm ? 'Direct Message' : kind === 'space' ? 'Class' : 'Channel';
  const iconTheme = !isDm
    ? themeAvatarColor(themeKey, colors.inputBg, colors.text)
    : { bg: colors.inputBg, fg: colors.text };
  const visibleTabs = useMemo(
    () => (isDm ? [] : getVisibleChannelInfoTabs(channelUiDefaults)),
    [channelUiDefaults, isDm],
  );
  useEffect(
    () => () => {
      if (joinTransitionTimeoutRef.current) {
        clearTimeout(joinTransitionTimeoutRef.current);
      }
    },
    [],
  );

  const handleJoinPress = useCallback(
    (closeSheet?: () => void) => {
      if (!liveJoinUrl) return;
      onJoinPress?.();

      if (joinTransitionTimeoutRef.current) {
        clearTimeout(joinTransitionTimeoutRef.current);
      }
      const openJoinTarget = () => {
        if (isExternalJoinHref(liveJoinUrl)) {
          setExternalJoinTarget({
            joinHref: liveJoinUrl,
            providerLabel: resolveExternalJoinProviderLabel(liveJoinUrl),
          });
          return;
        }
        Linking.openURL(liveJoinUrl).catch(() => null);
      };

      closeSheet?.();
      if (!closeSheet) {
        onClose();
      }
      joinTransitionTimeoutRef.current = setTimeout(() => {
        joinTransitionTimeoutRef.current = null;
        openJoinTarget();
      }, JOIN_AFTER_CLOSE_DELAY_MS);
    },
    [liveJoinUrl, onClose, onJoinPress],
  );
  const handleOpenJoinHref = useCallback((joinHref: string) => {
    Linking.openURL(joinHref).catch(() => null);
  }, []);
  const handleShareJoinHref = useCallback(async () => {
    if (!externalJoinTarget?.joinHref) return;
    try {
      await Share.share({
        message: externalJoinTarget.joinHref,
        url: externalJoinTarget.joinHref,
      });
    } catch {
      // best effort share
    }
  }, [externalJoinTarget?.joinHref]);

  // ── Files: fetch directly from channel_files + channel_media tables ─────────
  // Messages are paginated (last ~40), so we can't extract files from them reliably.
  // The url column in these tables stores the storage path, not a public URL.
  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [loadedMembers, setLoadedMembers] = useState<
    Array<{
      id: string;
      name: string;
      avatarSeed?: string | null;
      themeKey?: string | null;
      role?: string | null;
      profile?: UserProfileVM | null;
    }>
  >([]);
  const [membersLoading, setMembersLoading] = useState(false);

  useEffect(() => {
    if (!visible || !channelId) return;
    setFileItems([]);
    setFilesLoading(true);

    (async () => {
      try {
        const [filesResult, mediaResult] = await Promise.all([
          supabase
            .from('channel_files')
            .select('id, url, name, mime_type, size, created_at')
            .eq('channel_id', channelId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(100),
          supabase
            .from('channel_media')
            .select('id, url, name, created_at')
            .eq('channel_id', channelId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(100),
        ]);

        const items: FileItem[] = [];

        for (const f of filesResult.data ?? []) {
          items.push({
            id: String(f.id),
            name: String(f.name ?? 'file'),
            url: String(f.url),
            storagePath: String(f.url), // url IS the storage path in this table
            mimeType: f.mime_type ? String(f.mime_type) : undefined,
            size: f.size ? Number(f.size) : undefined,
            createdAt: String(f.created_at),
            kind: 'file',
          });
        }

        for (const m of mediaResult.data ?? []) {
          items.push({
            id: String(m.id),
            name: String(m.name ?? 'image'),
            url: String(m.url),
            storagePath: String(m.url), // url IS the storage path in this table
            createdAt: String(m.created_at),
            kind: 'image',
          });
        }

        items.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setFileItems(items);
      } catch {
        // silently fail — empty files tab
      } finally {
        setFilesLoading(false);
      }
    })();
  }, [visible, channelId]);

  useEffect(() => {
    if (!visible || !channelId) return;
    setLoadedMembers([]);
    setMembersLoading(true);

    (async () => {
      try {
        const memberRows = await fetchChannelMembers(orgId, channelId, currentProfileId);
        const nextMembers = memberRows.map((member) => ({
          id: member.id,
          name: member.name,
          avatarSeed: member.avatarSeed ?? member.name,
          themeKey: member.themeKey ?? null,
          role: member.role,
          profile: buildMemberProfile({
            id: member.id,
            orgId,
            accountId: member.accountId,
            name: member.name,
            avatarSeed: member.avatarSeed ?? member.name,
            themeKey: member.themeKey,
            role: member.role,
            bio: member.bio,
            email: member.email,
            timezone: member.timezone,
          }),
        }));

        setLoadedMembers(nextMembers);
      } catch {
        // silently fail — empty members tab
      } finally {
        setMembersLoading(false);
      }
    })();
  }, [channelId, currentProfileId, orgId, visible]);

  useEffect(() => {
    if (!visible || !channelId || isDm) {
      setChannelUiDefaults(null);
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from('channels')
          .select('ui_defaults')
          .eq('id', channelId)
          .is('deleted_at', null)
          .maybeSingle();

        if (error) {
          throw error;
        }

        setChannelUiDefaults(parseChannelUiDefaults(data?.ui_defaults));
      } catch {
        setChannelUiDefaults({ disabledTabs: [] });
      }
    })();
  }, [channelId, isDm, visible]);

  // Derived data for saved/members tabs (from messages prop)
  const savedItems = useMemo(() => extractSaved(messages), [messages]);
  const memberItems = useMemo(
    () => extractMembers(messages, loadedMembers.length > 0 ? loadedMembers : members),
    [loadedMembers, messages, members],
  );

  // ── Open animation ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setActiveTab(visibleTabs[0]?.key ?? 'files');
    }
  }, [visible, visibleTabs]);

  useEffect(() => {
    if (!visibleTabs.length) {
      return;
    }

    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(visibleTabs[0]!.key);
    }
  }, [activeTab, visibleTabs]);

  const handleMemberMessage = useCallback(
    async (memberId: string, memberName: string) => {
      if (!orgId || !currentProfileId || !memberId || memberId === currentProfileId) {
        return;
      }

      try {
        const dm = await ensureDirectMessageChannelForProfiles(
          orgId,
          currentProfileId,
          memberId,
        );
        if (!dm) {
          Alert.alert('Unable to open direct message', `Cannot message ${memberName}.`);
          return;
        }

        void queryClient.invalidateQueries({
          queryKey: queryKeys.directMessages(orgId, currentProfileId),
        });
        onClose();
        router.push({
          pathname: '/(app)/dm/[channelId]',
          params: {
            channelId: dm.channelId,
            topic: dm.topic,
            avatarSeed: dm.avatarSeed ?? '',
            avatarUrl: dm.avatarUrl ?? '',
            avatarRole: dm.avatarRole ?? '',
            avatarThemeKey: dm.avatarThemeKey ?? '',
            avatarTimezone: dm.avatarTimezone ?? '',
            avatarCity: dm.avatarCity ?? '',
            avatarCountryCode: dm.avatarCountryCode ?? '',
            avatarCountryName: dm.avatarCountryName ?? '',
          },
        } as never);
      } catch {
        Alert.alert('Unable to open direct message', 'Please try again.');
      }
    },
    [currentProfileId, onClose, orgId, queryClient, router],
  );

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        allowExpand
        enablePartialOverlay
        partialOverlayTopInset={PARTIAL_OVERLAY_TOP_INSET}
        topInset={insets.top}
        bottomInset={insets.bottom}
        partialHeight={Dimensions.get('screen').height * PARTIAL_HEIGHT_RATIO}
        sheetStyle={s.sheet}
      >
        {({ isExpanded, close }) =>
          isDm ? (
            /* ── DM: hero + static info rows ── */
            <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={isExpanded}>
              {/* Hero */}
              <View style={s.hero}>
                <View style={{ width: 72, height: 72, position: 'relative' }}>
                  <View
                    style={[s.avatarCircle, { backgroundColor: heroAvatarColors.bg }]}
                  >
                    <Text style={[s.avatarTxt, { color: heroAvatarColors.fg }]}>
                      {getInitials(title)}
                    </Text>
                  </View>
                </View>
                <RoleNameIndicator
                  name={title}
                  role={avatarRole}
                  textStyle={s.heroName}
                  iconSize={14}
                />
                {!!subtitle && <Text style={s.heroSub}>{subtitle}</Text>}
              </View>

              {/* Info rows */}
              <View style={s.section}>
                <View style={s.row}>
                  <Text style={s.rowIcon}>💬</Text>
                  <Text style={s.rowLabel}>Type</Text>
                  <Text style={s.rowValue}>{typeLabel}</Text>
                </View>
                {memberCount != null && (
                  <>
                    <View style={s.rowSep} />
                    <View style={s.row}>
                      <Text style={s.rowIcon}>👥</Text>
                      <Text style={s.rowLabel}>Members</Text>
                      <Text style={s.rowValue}>{memberCount}</Text>
                    </View>
                  </>
                )}
                {!!description && (
                  <>
                    <View style={s.rowSep} />
                    <View style={s.row}>
                      <Text style={s.rowIcon}>📝</Text>
                      <Text style={s.rowLabel}>Description</Text>
                      <Text style={s.rowValue} numberOfLines={2}>
                        {description}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </ScrollView>
          ) : (
            /* ── Channel / Space: compact hero + fixed tabs + scrollable content ── */
            <>
              <View style={s.heroCompact}>
                <ChannelTopicIconBadge
                  iconKey={iconKey}
                  size={56}
                  iconSize={28}
                  borderRadius={28}
                  backgroundColor={iconTheme.bg}
                  color={iconTheme.fg}
                  style={s.avatarCircleCompact}
                />
                <Text style={s.heroNameCompact}>{title}</Text>
                {!!subtitle && <Text style={s.heroSub}>{subtitle}</Text>}
                {!!liveJoinUrl && (
                  <TouchableOpacity
                    style={s.heroJoinButton}
                    onPress={() => handleJoinPress(close)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Join live session"
                  >
                    <Video size={14} color={colors.teal} />
                    <Text style={s.heroJoinButtonText}>Join</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Fixed tab bar */}
              {visibleTabs.length > 1 ? (
                <View style={s.tabBar}>
                  {visibleTabs.map((tab) => {
                    const isActive = activeTab === tab.key;
                    const tabColor = isActive ? colors.teal : colors.textMuted;
                    return (
                      <TouchableOpacity
                        key={tab.key}
                        style={[s.tabItem, isActive && s.tabItemActive]}
                        onPress={() => setActiveTab(tab.key)}
                        activeOpacity={0.7}
                      >
                        <TabIcon tabKey={tab.key} color={tabColor} />
                        <Text style={[s.tabLabel, isActive && s.tabLabelActive]}>
                          {tab.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              {/* Tab content — flex: 1 so it fills remaining space */}
              <View style={{ flex: 1 }}>
                {visibleTabs.length > 0 ? (
                  <TabContent
                    activeTab={activeTab}
                    fileItems={fileItems}
                    filesLoading={filesLoading}
                    membersLoading={membersLoading}
                    savedItems={savedItems}
                    memberItems={memberItems}
                    colors={colors}
                    s={s}
                    memberCount={memberCount}
                    isFullScreen={isExpanded}
                    currentProfileId={currentProfileId}
                    onMemberMessage={handleMemberMessage}
                    onProfilePress={onProfilePress}
                  />
                ) : (
                  <EmptyTabState
                    icon={<FileText size={22} color={colors.textMuted} />}
                    title="Nothing to show"
                    description="This panel is hidden by the channel settings."
                    colors={colors}
                    s={s}
                  />
                )}
              </View>
            </>
          )
        }
      </BottomSheet>

      <Modal
        animationType="fade"
        transparent={true}
        visible={Boolean(externalJoinTarget)}
        onRequestClose={() => setExternalJoinTarget(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setExternalJoinTarget(null)}>
          <Pressable style={s.modalCard} onPress={(event) => event.stopPropagation()}>
            <View style={s.modalHeading}>
              <Text style={s.modalTitle}>Session ready to join</Text>
              <Text style={s.modalDescription}>
                This session opens in an external provider. Stay here until you are ready,
                then use the link below to join.
              </Text>
            </View>
            <View style={s.modalLinkBox}>
              <Text style={s.modalLinkLabel}>Join link</Text>
              <Text style={s.modalLinkValue}>{externalJoinTarget?.joinHref}</Text>
            </View>
            <View style={s.modalFooter}>
              <TouchableOpacity
                style={[s.modalButton, s.modalButtonSecondary]}
                onPress={() => void handleShareJoinHref()}
                activeOpacity={0.85}
                accessibilityLabel="Share join link"
              >
                <Share2 size={16} color={colors.text} />
                <Text style={s.modalButtonSecondaryText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalButton, s.modalButtonPrimary]}
                onPress={() => {
                  if (externalJoinTarget?.joinHref) {
                    handleOpenJoinHref(externalJoinTarget.joinHref);
                  }
                  setExternalJoinTarget(null);
                }}
                activeOpacity={0.85}
                accessibilityLabel={
                  externalJoinTarget?.providerLabel
                    ? `Open ${externalJoinTarget.providerLabel}`
                    : 'Open session'
                }
              >
                <Video size={16} color={colors.tealFg} />
                <Text style={s.modalButtonPrimaryText}>
                  {externalJoinTarget?.providerLabel
                    ? `Join ${externalJoinTarget.providerLabel}`
                    : 'Join session'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.modalCloseIconButton}
                onPress={() => setExternalJoinTarget(null)}
                activeOpacity={0.85}
                accessibilityLabel="Close join dialog"
              >
                <X size={16} color={colors.text} />
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export const __test__ = {
  getVisibleChannelInfoTabs,
  parseChannelUiDefaults,
};
