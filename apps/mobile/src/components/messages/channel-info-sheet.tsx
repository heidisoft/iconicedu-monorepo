import React, { useMemo, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FileText,
  CalendarDays,
  Bookmark,
  Users,
  X,
  Image as ImageIcon,
  Mic,
  Download,
  File,
} from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import type {
  MessageVM,
  ImageMessageVM,
  FileMessageVM,
  AudioRecordingMessageVM,
  TextMessageVM,
  UserProfileVM,
} from '@iconicedu/shared-types';

// ─── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#5B8DEF', '#E07B54', '#6CC070', '#A86CC1', '#E0A854', '#54B8C4', '#E06C8A'];

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

// ─── Sender name helper ────────────────────────────────────────────────────────

function getSenderName(sender: UserProfileVM): string {
  return sender.profile.displayName?.trim() || sender.profile.firstName?.trim() || 'Unknown';
}

// ─── Data extraction helpers ───────────────────────────────────────────────────

type FileItem = {
  id: string;
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
  durationSeconds?: number;
  createdAt: string;
  kind: 'image' | 'file' | 'audio';
};

function extractFiles(messages: MessageVM[]): FileItem[] {
  const items: FileItem[] = [];
  for (const msg of messages) {
    if (msg.core.type === 'image') {
      const m = msg as ImageMessageVM;
      const allAttachments = m.attachments ?? [m.attachment];
      for (const att of allAttachments) {
        items.push({
          id: `${msg.ids.id}-${att.name}`,
          name: att.name,
          url: att.url,
          kind: 'image',
          createdAt: msg.core.createdAt,
        });
      }
    } else if (msg.core.type === 'file') {
      const m = msg as FileMessageVM;
      const allAttachments = m.attachments ?? [m.attachment];
      for (const att of allAttachments) {
        items.push({
          id: `${msg.ids.id}-${att.name}`,
          name: att.name,
          url: att.url,
          mimeType: att.mimeType,
          size: att.size,
          kind: 'file',
          createdAt: msg.core.createdAt,
        });
      }
    } else if (msg.core.type === 'audio-recording') {
      const m = msg as AudioRecordingMessageVM;
      items.push({
        id: msg.ids.id,
        name: 'Voice message',
        url: m.audio.url,
        mimeType: m.audio.mimeType,
        size: m.audio.fileSize,
        durationSeconds: m.audio.durationSeconds,
        kind: 'audio',
        createdAt: msg.core.createdAt,
      });
    }
  }
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

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
    case 'text': return (msg as TextMessageVM).content.text.slice(0, 120);
    case 'image': return '📷 Photo';
    case 'file': return `📎 ${(msg as FileMessageVM).attachment.name}`;
    case 'audio-recording': return '🎤 Voice message';
    default: return 'Message';
  }
}

function extractSaved(messages: MessageVM[]): Array<{ id: string; senderName: string; preview: string; createdAt: string }> {
  return messages
    .filter((m) => m.state?.isSaved)
    .map((m) => ({
      id: m.ids.id,
      senderName: getSenderName(m.core.sender),
      preview: getMessagePreview(m),
      createdAt: m.core.createdAt,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function extractMembers(
  messages: MessageVM[],
  extraMembers?: Array<{ id: string; name: string; avatarSeed?: string | null }> | null,
): Array<{ id: string; name: string; seed: string }> {
  const map = new Map<string, { id: string; name: string; seed: string }>();
  for (const msg of messages) {
    const s = msg.core.sender;
    if (!map.has(s.ids.id)) {
      const name = getSenderName(s);
      map.set(s.ids.id, { id: s.ids.id, name, seed: name });
    }
  }
  if (extraMembers) {
    for (const m of extraMembers) {
      if (!map.has(m.id)) {
        map.set(m.id, { id: m.id, name: m.name, seed: m.avatarSeed ?? m.name });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type ChannelTab = 'files' | 'sessions' | 'saved' | 'members';

export type ChannelInfoSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string | null;
  kind: 'dm' | 'channel' | 'space';
  avatarSeed?: string | null;
  iconEmoji?: string | null;
  memberCount?: number | null;
  description?: string | null;
  members?: Array<{ id: string; name: string; avatarSeed?: string | null }> | null;
  messages?: MessageVM[];
  onClose: () => void;
};

// ─── Tab definitions ───────────────────────────────────────────────────────────

const TABS: Array<{ key: ChannelTab; label: string }> = [
  { key: 'files',    label: 'Files' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'saved',    label: 'Saved' },
  { key: 'members',  label: 'Members' },
];

// ─── Tab icon renderer ─────────────────────────────────────────────────────────

function TabIcon({ tabKey, color }: { tabKey: ChannelTab; color: string }) {
  const size = 16;
  if (tabKey === 'files')    return <FileText    size={size} color={color} />;
  if (tabKey === 'sessions') return <CalendarDays size={size} color={color} />;
  if (tabKey === 'saved')    return <Bookmark    size={size} color={color} />;
  return <Users size={size} color={color} />;
}

// ─── File item row ─────────────────────────────────────────────────────────────

function FileItemRow({ item, colors, s }: { item: FileItem; colors: AppColors; s: ReturnType<typeof makeStyles> }) {
  const isImage = item.kind === 'image';
  const isAudio = item.kind === 'audio';

  const iconBg = isImage ? colors.tealBg : isAudio ? '#F0E8FF' : colors.card;
  const iconColor = isImage ? colors.teal : isAudio ? '#9333ea' : colors.text;

  const meta: string[] = [];
  if (item.mimeType) meta.push(item.mimeType.split('/').pop() ?? item.mimeType);
  if (item.size) meta.push(formatFileSize(item.size));
  if (item.durationSeconds) meta.push(`${item.durationSeconds}s`);
  meta.push(formatRelativeDate(item.createdAt));

  return (
    <View style={s.fileItem}>
      <View style={[s.fileIconBox, { backgroundColor: iconBg }]}>
        {isImage ? (
          <ImageIcon size={20} color={iconColor} />
        ) : isAudio ? (
          <Mic size={20} color={iconColor} />
        ) : (
          <File size={20} color={iconColor} />
        )}
      </View>
      <View style={s.fileInfo}>
        <Text style={s.fileName} numberOfLines={1}>{item.name}</Text>
        <Text style={s.fileMeta} numberOfLines={1}>{meta.filter(Boolean).join(' • ')}</Text>
      </View>
      <TouchableOpacity
        style={s.fileDownloadBtn}
        onPress={() => void Linking.openURL(item.url)}
        hitSlop={8}
        activeOpacity={0.7}
      >
        <Download size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Tab content ───────────────────────────────────────────────────────────────

type TabContentProps = {
  activeTab: ChannelTab;
  fileItems: FileItem[];
  savedItems: Array<{ id: string; senderName: string; preview: string; createdAt: string }>;
  memberItems: Array<{ id: string; name: string; seed: string }>;
  colors: AppColors;
  s: ReturnType<typeof makeStyles>;
  memberCount?: number | null;
};

function TabContent({ activeTab, fileItems, savedItems, memberItems, colors, s, memberCount }: TabContentProps) {
  if (activeTab === 'files') {
    if (fileItems.length === 0) {
      return (
        <View style={s.emptyState}>
          <FileText size={44} color={colors.textMuted} style={{ opacity: 0.4 }} />
          <Text style={s.emptyTitle}>No files yet</Text>
          <Text style={s.emptySubtitle}>Shared photos, files, and voice messages will appear here</Text>
        </View>
      );
    }
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {fileItems.map((item) => (
          <FileItemRow key={item.id} item={item} colors={colors} s={s} />
        ))}
      </ScrollView>
    );
  }

  if (activeTab === 'sessions') {
    return (
      <View style={s.emptyState}>
        <CalendarDays size={44} color={colors.textMuted} style={{ opacity: 0.4 }} />
        <Text style={s.emptyTitle}>No sessions scheduled</Text>
        <Text style={s.emptySubtitle}>Scheduled sessions for this channel will appear here</Text>
      </View>
    );
  }

  if (activeTab === 'saved') {
    if (savedItems.length === 0) {
      return (
        <View style={s.emptyState}>
          <Bookmark size={44} color={colors.textMuted} style={{ opacity: 0.4 }} />
          <Text style={s.emptyTitle}>No saved messages</Text>
          <Text style={s.emptySubtitle}>Long-press any message and tap "Save" to find it here</Text>
        </View>
      );
    }
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {savedItems.map((item) => {
          const color = avatarColor(item.senderName);
          return (
            <View key={item.id} style={s.savedItem}>
              <View style={[s.savedAvatar, { backgroundColor: color }]}>
                <Text style={s.savedAvatarTxt}>{getInitials(item.senderName)}</Text>
              </View>
              <View style={s.savedBody}>
                <View style={s.savedSenderRow}>
                  <Text style={s.savedSenderName}>{item.senderName}</Text>
                  <Text style={s.savedDate}>{formatRelativeDate(item.createdAt)}</Text>
                </View>
                <Text style={s.savedPreview} numberOfLines={2}>{item.preview}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  }

  // Members tab
  const displayCount = memberItems.length > 0 ? memberItems.length : (memberCount ?? 0);
  if (memberItems.length === 0) {
    return (
      <View style={s.emptyState}>
        <Users size={44} color={colors.textMuted} style={{ opacity: 0.4 }} />
        <Text style={s.emptyTitle}>No members yet</Text>
      </View>
    );
  }
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={s.membersHeader}>
        <Text style={s.membersCount}>
          {displayCount} member{displayCount !== 1 ? 's' : ''}
        </Text>
      </View>
      {memberItems.map((member) => (
        <View key={member.id} style={s.memberRow}>
          <View style={[s.memberAvatar, { backgroundColor: avatarColor(member.seed) }]}>
            <Text style={s.memberAvatarTxt}>{getInitials(member.name)}</Text>
          </View>
          <Text style={s.memberName}>{member.name}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  const hairline = StyleSheet.hairlineWidth;
  return StyleSheet.create({
    // ── Full-screen container ─────────────────────────────────────────────────
    container: {
      flex: 1,
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
    iconEmojiTxt: { fontSize: 36 },
    iconEmojiTxtCompact: { fontSize: 28 },
    heroName: { fontSize: 22, fontWeight: '700', color: C.text, textAlign: 'center' },
    heroNameCompact: { fontSize: 18, fontWeight: '700', color: C.text, textAlign: 'center' },
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
      flex: 1,
    },
  });
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ChannelInfoSheet({
  visible,
  title,
  subtitle,
  kind,
  avatarSeed,
  iconEmoji,
  memberCount,
  description,
  members,
  messages = [],
  onClose,
}: ChannelInfoSheetProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<ChannelTab>('files');

  useEffect(() => {
    if (visible) setActiveTab('files');
  }, [visible]);

  const isDm = kind === 'dm';
  const seed = avatarSeed ?? title;
  const typeLabel = isDm ? 'Direct Message' : kind === 'space' ? 'Learning Space' : 'Channel';

  // Derived data for tabs
  const fileItems = useMemo(() => extractFiles(messages), [messages]);
  const savedItems = useMemo(() => extractSaved(messages), [messages]);
  const memberItems = useMemo(() => extractMembers(messages, members), [messages, members]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[s.container, { paddingTop: insets.top }]}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
          <TouchableOpacity
            style={s.closeIconBtn}
            onPress={onClose}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <X size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {isDm ? (
          /* ── DM: hero + static info rows in ScrollView ── */
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Hero */}
            <View style={s.hero}>
              <View style={[s.avatarCircle, { backgroundColor: avatarColor(seed) }]}>
                <Text style={s.avatarTxt}>{getInitials(title)}</Text>
              </View>
              <Text style={s.heroName}>{title}</Text>
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
                    <Text style={s.rowValue} numberOfLines={2}>{description}</Text>
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        ) : (
          /* ── Channel / Space: compact hero + fixed tabs + scrollable content ── */
          <>
            {/* Compact hero */}
            <View style={s.heroCompact}>
              <View style={[s.iconBoxCompact, { backgroundColor: colors.tealBg }]}>
                <Text style={s.iconEmojiTxtCompact}>{iconEmoji ?? '📚'}</Text>
              </View>
              <Text style={s.heroNameCompact}>{title}</Text>
              {!!subtitle && <Text style={s.heroSub}>{subtitle}</Text>}
            </View>

            {/* Fixed tab bar */}
            <View style={s.tabBar}>
              {TABS.map((tab) => {
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

            {/* Tab content — flex: 1 so it fills remaining space */}
            <View style={{ flex: 1 }}>
              <TabContent
                activeTab={activeTab}
                fileItems={fileItems}
                savedItems={savedItems}
                memberItems={memberItems}
                colors={colors}
                s={s}
                memberCount={memberCount}
              />
            </View>
          </>
        )}

      </View>
    </Modal>
  );
}
