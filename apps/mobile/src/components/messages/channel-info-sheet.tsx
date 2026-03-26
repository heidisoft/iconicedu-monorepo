import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Animated,
  PanResponder,
  Dimensions,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
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
} from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import type {
  ChannelUiTabKeyVM,
  MessageVM,
  TextMessageVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import { LearningSpaceIconBadge } from '@/lib/learning-space-icons';
import { RoleNameIndicator } from '@/components/profile/role-name-indicator';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import { findDirectMessageChannelForProfiles } from '@/lib/api/queries';

const CHANNEL_FILES_BUCKET = 'channel-files';

// ─── Screen dimensions ─────────────────────────────────────────────────────────
// Use 'screen' (not 'window') so the full display height is captured on Android,
// including the system navigation bar area when navigationBarTranslucent is set.

const SCREEN_HEIGHT = Dimensions.get('screen').height;
const PARTIAL_HEIGHT = SCREEN_HEIGHT * 0.58;

// ─── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#5B8DEF',
  '#E07B54',
  '#6CC070',
  '#A86CC1',
  '#E0A854',
  '#54B8C4',
  '#E06C8A',
];

const THEME_AVATAR_COLORS: Record<string, { bg: string; fg: string }> = {
  slate: { bg: '#64748b', fg: '#ffffff' },
  gray: { bg: '#6b7280', fg: '#ffffff' },
  zinc: { bg: '#71717a', fg: '#ffffff' },
  neutral: { bg: '#737373', fg: '#ffffff' },
  stone: { bg: '#78716c', fg: '#ffffff' },
  red: { bg: '#ef4444', fg: '#ffffff' },
  orange: { bg: '#f97316', fg: '#ffffff' },
  amber: { bg: '#f59e0b', fg: '#1f2937' },
  yellow: { bg: '#eab308', fg: '#1f2937' },
  lime: { bg: '#84cc16', fg: '#1f2937' },
  green: { bg: '#22c55e', fg: '#ffffff' },
  emerald: { bg: '#10b981', fg: '#ffffff' },
  teal: { bg: '#14b8a6', fg: '#ffffff' },
  cyan: { bg: '#06b6d4', fg: '#ffffff' },
  sky: { bg: '#0ea5e9', fg: '#ffffff' },
  blue: { bg: '#3b82f6', fg: '#ffffff' },
  indigo: { bg: '#6366f1', fg: '#ffffff' },
  violet: { bg: '#8b5cf6', fg: '#ffffff' },
  purple: { bg: '#a855f7', fg: '#ffffff' },
  fuchsia: { bg: '#d946ef', fg: '#ffffff' },
  pink: { bg: '#ec4899', fg: '#ffffff' },
  rose: { bg: '#f43f5e', fg: '#ffffff' },
};

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return name[0]?.toUpperCase() ?? '?';
}

function themeAvatarColor(
  themeKey?: string | null,
  fallbackBg?: string,
  fallbackFg?: string,
): { bg: string; fg: string } {
  return (
    (themeKey && THEME_AVATAR_COLORS[themeKey]) || {
      bg: fallbackBg || '#f8fafc',
      fg: fallbackFg || '#0f172a',
    }
  );
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
  preview: string;
  createdAt: string;
}> {
  return messages
    .filter((m) => m.state?.isSaved)
    .map((m) => ({
      id: m.ids.id,
      senderName: getSenderName(m.core.sender),
      senderRole: m.core.sender.kind,
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
    role?: string | null;
  }> | null,
): Array<{ id: string; name: string; seed: string; role?: string | null }> {
  const map = new Map<
    string,
    { id: string; name: string; seed: string; role?: string | null }
  >();
  for (const msg of messages) {
    const s = msg.core.sender;
    if (!map.has(s.ids.id)) {
      const name = getSenderName(s);
      map.set(s.ids.id, { id: s.ids.id, name, seed: name, role: s.kind });
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
        });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
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
  avatarRole?: string | null;
  iconKey?: string | null;
  themeKey?: string | null;
  memberCount?: number | null;
  description?: string | null;
  members?: Array<{
    id: string;
    name: string;
    avatarSeed?: string | null;
    role?: string | null;
  }> | null;
  messages?: MessageVM[];
  onClose: () => void;
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
    preview: string;
    createdAt: string;
  }>;
  memberItems: Array<{ id: string; name: string; seed: string; role?: string | null }>;
  colors: AppColors;
  s: ReturnType<typeof makeStyles>;
  memberCount?: number | null;
  isFullScreen: boolean;
  currentProfileId?: string | null;
  onMemberMessage?: (memberId: string, memberName: string) => void;
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
          const color = avatarColor(item.senderName);
          return (
            <View key={item.id} style={s.savedItem}>
              <View style={{ width: 40, height: 40, position: 'relative' }}>
                <View style={[s.savedAvatar, { backgroundColor: color }]}>
                  <Text style={s.savedAvatarTxt}>{getInitials(item.senderName)}</Text>
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
          <View style={{ width: 36, height: 36, position: 'relative' }}>
            <View style={[s.memberAvatar, { backgroundColor: avatarColor(member.seed) }]}>
              <Text style={s.memberAvatarTxt}>{getInitials(member.name)}</Text>
            </View>
          </View>
          <View style={s.memberInfo}>
            <RoleNameIndicator
              name={member.name}
              role={member.role}
              textStyle={s.memberName}
              iconSize={12}
            />
          </View>
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
    // ── Backdrop ──────────────────────────────────────────────────────────────
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },

    // ── Animated sheet ────────────────────────────────────────────────────────
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: SCREEN_HEIGHT,
      backgroundColor: C.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 16,
    },

    // ── Drag handle ───────────────────────────────────────────────────────────
    dragArea: {
      width: '100%',
      paddingVertical: 12,
      alignItems: 'center',
    },
    dragHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
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
      fontSize: 17,
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
    avatarTxt: { color: '#fff', fontWeight: '700', fontSize: 28 },
    avatarTxtCompact: { color: '#fff', fontWeight: '700', fontSize: 22 },
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
    heroName: { fontSize: 22, fontWeight: '700', color: C.text, textAlign: 'center' },
    heroNameCompact: {
      fontSize: 18,
      fontWeight: '700',
      color: C.text,
      textAlign: 'center',
    },
    heroSub: { fontSize: 14, color: C.textMuted, textAlign: 'center' },

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
    rowIcon: { fontSize: 18, width: 24, textAlign: 'center' },
    rowLabel: { flex: 1, fontSize: 14, color: C.textMuted },
    rowValue: {
      fontSize: 14,
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
      fontSize: 11,
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
      fontSize: 16,
      fontWeight: '600',
      color: C.text,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 13,
      color: C.textMuted,
      textAlign: 'center',
      lineHeight: 19,
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
      fontSize: 14,
      fontWeight: '600',
      color: C.text,
    },
    fileMeta: {
      fontSize: 12,
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
      fontSize: 13,
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
      fontSize: 14,
      fontWeight: '600',
      color: C.text,
    },
    savedDate: {
      fontSize: 11,
      color: C.textMuted,
    },
    savedPreview: {
      fontSize: 13,
      color: C.textMuted,
      lineHeight: 18,
    },

    // ── Members tab ───────────────────────────────────────────────────────────
    membersHeader: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: hairline,
      borderBottomColor: C.border,
    },
    membersCount: {
      fontSize: 13,
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
      fontSize: 15,
    },
    memberName: {
      fontSize: 15,
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
      fontSize: 11,
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
  avatarRole,
  iconKey,
  themeKey,
  memberCount,
  description,
  members,
  messages = [],
  onClose,
}: ChannelInfoSheetProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const orgId = account?.org_id ?? '';
  const currentProfileId =
    ((profile as Record<string, unknown> | undefined)?.id as string | undefined) ?? '';

  const [activeTab, setActiveTab] = useState<ChannelTab>('files');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [channelUiDefaults, setChannelUiDefaults] =
    useState<ParsedMobileChannelUiDefaults | null>(null);

  // translateY: 0 = full screen top, SCREEN_HEIGHT - PARTIAL_HEIGHT = partial, SCREEN_HEIGHT = hidden
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const isFullScreenRef = useRef(false);
  // Tracks translateY value at gesture start to avoid stale closure
  const panRef = useRef<number>(SCREEN_HEIGHT - PARTIAL_HEIGHT);

  const isDm = kind === 'dm';
  const seed = avatarSeed ?? title;
  const typeLabel = isDm ? 'Direct Message' : kind === 'space' ? 'Class' : 'Channel';
  const iconTheme = !isDm
    ? themeAvatarColor(themeKey, colors.inputBg, colors.text)
    : { bg: colors.inputBg, fg: colors.text };
  const visibleTabs = useMemo(
    () => (isDm ? [] : getVisibleChannelInfoTabs(channelUiDefaults)),
    [channelUiDefaults, isDm],
  );

  // ── Files: fetch directly from channel_files + channel_media tables ─────────
  // Messages are paginated (last ~40), so we can't extract files from them reliably.
  // The url column in these tables stores the storage path, not a public URL.
  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [loadedMembers, setLoadedMembers] = useState<
    Array<{ id: string; name: string; avatarSeed?: string | null; role?: string | null }>
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
        const { data, error } = await supabase
          .from('channel_members')
          .select(
            `
            profile_id,
            profile:profiles!profile_id(display_name, first_name, last_name, avatar_seed, kind)
          `,
          )
          .eq('channel_id', channelId)
          .is('deleted_at', null);

        if (error) throw error;

        const nextMembers = (data ?? [])
          .flatMap((row) => {
            const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
            if (!profile) return [];
            const name =
              profile.display_name?.trim() ||
              [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
            if (!name) return [];
            return [
              {
                id: String(row.profile_id),
                name,
                avatarSeed: profile.avatar_seed ? String(profile.avatar_seed) : name,
                role: profile.kind ? String(profile.kind) : null,
              },
            ];
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        setLoadedMembers(nextMembers);
      } catch {
        // silently fail — empty members tab
      } finally {
        setMembersLoading(false);
      }
    })();
  }, [visible, channelId]);

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
      isFullScreenRef.current = false;
      setIsFullScreen(false);
      setActiveTab(visibleTabs[0]?.key ?? 'files');
      sheetTranslateY.setValue(SCREEN_HEIGHT);
      Animated.spring(sheetTranslateY, {
        toValue: SCREEN_HEIGHT - PARTIAL_HEIGHT,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    }
  }, [sheetTranslateY, visible, visibleTabs]);

  useEffect(() => {
    if (!visibleTabs.length) {
      return;
    }

    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(visibleTabs[0]!.key);
    }
  }, [activeTab, visibleTabs]);

  // ── Internal close (animate out then notify parent) ─────────────────────────
  const handleClose = useCallback(() => {
    Animated.timing(sheetTranslateY, {
      toValue: SCREEN_HEIGHT,
      useNativeDriver: true,
      duration: 220,
    }).start(() => {
      isFullScreenRef.current = false;
      setIsFullScreen(false);
      onClose();
    });
  }, [onClose, sheetTranslateY]);

  const handleMemberMessage = useCallback(
    async (memberId: string, memberName: string) => {
      if (!orgId || !currentProfileId || !memberId || memberId === currentProfileId) {
        return;
      }

      try {
        const dm = await findDirectMessageChannelForProfiles(
          orgId,
          currentProfileId,
          memberId,
        );
        if (!dm) {
          Alert.alert(
            'No direct message',
            `No direct message exists with ${memberName} yet.`,
          );
          return;
        }

        handleClose();
        router.push({
          pathname: '/(app)/dm/[channelId]',
          params: {
            channelId: dm.channelId,
            topic: dm.topic,
            avatarSeed: dm.avatarSeed ?? '',
            avatarUrl: dm.avatarUrl ?? '',
            avatarRole: dm.avatarRole ?? '',
            avatarTimezone: dm.avatarTimezone ?? '',
          },
        } as never);
      } catch {
        Alert.alert('Unable to open direct message', 'Please try again.');
      }
    },
    [currentProfileId, handleClose, orgId, router],
  );

  // ── Expand to full screen ───────────────────────────────────────────────────
  const expandToFull = useCallback(() => {
    isFullScreenRef.current = true;
    setIsFullScreen(true);
    Animated.spring(sheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 85,
      friction: 12,
    }).start();
  }, [sheetTranslateY]);

  // ── Stable refs for partial overlay pan responder ──────────────────────────
  const expandToFullRef = useRef<() => void>(() => {});
  const handleCloseRef = useRef<() => void>(() => {});
  useEffect(() => {
    expandToFullRef.current = expandToFull;
  }, [expandToFull]);
  useEffect(() => {
    handleCloseRef.current = handleClose;
  }, [handleClose]);

  // ── Partial overlay PanResponder — swipe down closes, tap/swipe-up expands ─
  const partialOverlayPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Only steal the gesture once there's clear vertical movement
      onMoveShouldSetPanResponder: (_, { dy, dx }) =>
        Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx),
      onPanResponderGrant: () => {
        sheetTranslateY.stopAnimation((val) => {
          panRef.current = val;
        });
      },
      onPanResponderMove: (_, { dy }) => {
        // Only allow dragging downward from partial mode
        if (dy > 0) {
          sheetTranslateY.setValue(Math.min(SCREEN_HEIGHT, panRef.current + dy));
        }
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (Math.abs(dy) < 8) {
          // Tap — expand to full
          expandToFullRef.current();
        } else if (dy > 60 || vy > 0.5) {
          // Swipe down — close the sheet
          handleCloseRef.current();
        } else if (dy < -30 || vy < -0.5) {
          // Swipe up — expand to full
          expandToFullRef.current();
        } else {
          // Small movement — snap back to partial
          Animated.spring(sheetTranslateY, {
            toValue: SCREEN_HEIGHT - PARTIAL_HEIGHT,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start();
        }
      },
    }),
  ).current;

  // ── PanResponder (drag handle) ──────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 8,
      onPanResponderGrant: () => {
        sheetTranslateY.stopAnimation((val) => {
          panRef.current = val;
        });
      },
      onPanResponderMove: (_, { dy }) => {
        const next = Math.max(0, Math.min(SCREEN_HEIGHT, panRef.current + dy));
        sheetTranslateY.setValue(next);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        const isCurrentlyFull = isFullScreenRef.current;
        if (dy < -50 || vy < -0.5) {
          // Swipe up → expand to full screen
          isFullScreenRef.current = true;
          setIsFullScreen(true);
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 85,
            friction: 12,
          }).start();
        } else if (dy > 80 || vy > 0.6) {
          if (isCurrentlyFull) {
            // Swipe down from full → collapse to partial
            isFullScreenRef.current = false;
            setIsFullScreen(false);
            Animated.spring(sheetTranslateY, {
              toValue: SCREEN_HEIGHT - PARTIAL_HEIGHT,
              useNativeDriver: true,
              tension: 80,
              friction: 12,
            }).start();
          } else {
            // Swipe down from partial → close
            Animated.timing(sheetTranslateY, {
              toValue: SCREEN_HEIGHT,
              useNativeDriver: true,
              duration: 220,
            }).start(() => {
              isFullScreenRef.current = false;
              setIsFullScreen(false);
              onClose();
            });
          }
        } else {
          // Snap back to current state
          Animated.spring(sheetTranslateY, {
            toValue: isCurrentlyFull ? 0 : SCREEN_HEIGHT - PARTIAL_HEIGHT,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start();
        }
      },
    }),
  ).current;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {/* Backdrop — tapping closes sheet when in partial mode */}
      <Pressable style={s.backdrop} onPress={!isFullScreen ? handleClose : undefined} />

      {/* Animated sheet — full height container, translated to show partial */}
      <Animated.View
        style={[
          s.sheet,
          { transform: [{ translateY: sheetTranslateY }] },
          isFullScreen && { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        {/* Drag handle — always visible, handles gesture for expand/collapse/close */}
        <View style={s.dragArea} {...panResponder.panHandlers}>
          <View style={s.dragHandle} />
        </View>

        {isDm ? (
          /* ── DM: hero + static info rows ── */
          <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={isFullScreen}>
            {/* Hero */}
            <View style={s.hero}>
              <View style={{ width: 72, height: 72, position: 'relative' }}>
                <View style={[s.avatarCircle, { backgroundColor: avatarColor(seed) }]}>
                  <Text style={s.avatarTxt}>{getInitials(title)}</Text>
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

            {/* Partial overlay — swipe down closes, tap expands */}
            {!isFullScreen && (
              <View
                style={StyleSheet.absoluteFill}
                {...partialOverlayPanResponder.panHandlers}
              />
            )}
          </ScrollView>
        ) : (
          /* ── Channel / Space: compact hero + fixed tabs + scrollable content ── */
          <>
            {/* Compact hero — also handles swipe-down when fully open */}
            <View
              style={s.heroCompact}
              {...(isFullScreen ? panResponder.panHandlers : {})}
            >
              <LearningSpaceIconBadge
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
                  isFullScreen={isFullScreen}
                  currentProfileId={currentProfileId}
                  onMemberMessage={handleMemberMessage}
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

            {/* Partial overlay — swipe down closes, tap expands */}
            {!isFullScreen && (
              <View
                style={StyleSheet.absoluteFill}
                {...partialOverlayPanResponder.panHandlers}
              />
            )}
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

export const __test__ = {
  getVisibleChannelInfoTabs,
  parseChannelUiDefaults,
};
