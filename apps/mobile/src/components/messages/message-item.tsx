import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  StyleProp,
  TextStyle,
  TouchableOpacity,
  Pressable,
  Linking,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import type {
  MessageVM,
  ThreadVM,
  LessonAssignmentMessageVM,
  SessionSummaryMessageVM,
  SessionCompleteMessageVM,
  ProgressUpdateMessageVM,
  EventReminderMessageVM,
  HomeworkSubmissionMessageVM,
  FeedbackRequestMessageVM,
  SessionBookingMessageVM,
  PaymentReminderMessageVM,
  LiveSessionStartedMessageVM,
  FileMessageVM,
  AudioRecordingMessageVM,
  ImageMessageVM,
  ImageAttachmentVM,
  LinkPreviewMessageVM,
  MessageMentionVM,
  ReactionVM,
} from '@iconicedu/shared-types';
import type { AppColors } from '@/lib/theme';
import type { PresenceDisplayStatus } from '@/hooks/use-online-profile-ids';
import { reportMobileObservedError } from '@/lib/analytics/report-error';
import { fetchThreadMessages } from '@/lib/api/queries';
import { useMarkRead } from '@/hooks/use-mark-read';
import { EmojiPicker } from './emoji-picker';
import {
  SmilePlus,
  CornerUpLeft,
  MessageCircle,
  Download,
  FileText,
  ExternalLink,
  Play,
  Pause,
  Video,
  BookOpenCheck,
  CalendarDays,
  ClipboardList,
  CreditCard,
  GraduationCap,
  Image as ImageIcon,
  LocateFixed,
  MessageSquareText,
  NotebookPen,
  TrendingUp,
  Check,
  EyeOff,
} from 'lucide-react-native';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioStatus } from 'expo-audio';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase/client';
import { Tooltip, TooltipContent, TooltipTrigger } from '@iconicedu/ui-native';
import { RoleAvatarBadge } from '@/components/profile/role-avatar-badge';
import { RoleNameIndicator } from '@/components/profile/role-name-indicator';
import { useTheme } from '@/providers/theme-provider';
import { profileAvatarColors } from '@/lib/profile-avatar-colors';
import { ChatImageViewer, type ChatImageViewerItem } from './chat-image-viewer';
import { ChatPdfViewer } from './chat-pdf-viewer';
import type { AttachmentPayload } from './attachment-sheet';

const CHANNEL_FILES_BUCKET = 'channel-files';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function isPdfAttachment(input: {
  name?: string | null;
  mimeType?: string | null;
}): boolean {
  const mimeType = input.mimeType?.toLowerCase() ?? '';
  const name = input.name?.toLowerCase() ?? '';
  return mimeType === 'application/pdf' || name.endsWith('.pdf');
}

type AvatarInfo = { url: string | null; seed: string };

export function getAvatarInfo(message: MessageVM): AvatarInfo {
  const profile = message.core.sender.profile as {
    avatar?: { source?: string; url?: string | null; seed?: string | null };
  };
  const avatar = profile.avatar;
  const url = avatar?.source === 'url' ? (avatar.url ?? null) : null;
  const seed =
    avatar?.source === 'seed'
      ? (avatar.seed ?? message.core.sender.ids.id)
      : message.core.sender.ids.id;
  return { url, seed };
}

// ─── Inline avatar (avoids NativeWind sizing issues on Image) ─────────────────

const AVATAR_SIZE = 36;
export function avatarBgColor(seed: string, themeKey?: string | null): string {
  return profileAvatarColors({ seed, themeKey }).bg;
}

export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return name[0]?.toUpperCase() ?? '?';
}

export function MessageAvatar({
  name,
  src,
  seed,
  role,
  presence,
  presenceStatus,
  themeKey,
  size = AVATAR_SIZE,
  badgeSizeOverride,
}: {
  name: string;
  src: string | null;
  seed: string;
  role?: string | null;
  presence?: MessageVM['core']['sender']['presence'];
  presenceStatus?: PresenceDisplayStatus | null;
  themeKey?: string | null;
  size?: number;
  badgeSizeOverride?: number;
}) {
  const radius = size / 2;
  const initialsSize = Math.max(10, Math.round(size * 0.36));
  const badgeSize = badgeSizeOverride ?? Math.max(10, Math.round(size * 0.42));
  const resolvedPresenceStatus =
    presenceStatus ?? presence?.displayStatus ?? presence?.liveStatus ?? null;
  const presenceColor = getAvatarPresenceColor(resolvedPresenceStatus);
  const avatarColors = profileAvatarColors({ seed, themeKey });
  const presenceSize = Math.max(10, Math.round(size * 0.28));
  const presenceBadge = presenceColor ? (
    <View
      accessibilityLabel={`Status: ${resolvedPresenceStatus}`}
      style={[
        avatarStyles.presenceBadge,
        {
          width: presenceSize,
          height: presenceSize,
          borderRadius: presenceSize / 2,
          backgroundColor: presenceColor,
        },
      ]}
      testID="message-avatar-presence"
    />
  ) : null;

  if (src) {
    return (
      <View style={[avatarStyles.wrap, { width: size, height: size }]}>
        <Image
          source={{ uri: src }}
          style={{ width: size, height: size, borderRadius: radius }}
          accessibilityLabel={name}
        />
        <RoleAvatarBadge role={role} size={badgeSize} />
        {presenceBadge}
      </View>
    );
  }
  return (
    <View style={[avatarStyles.wrap, { width: size, height: size }]}>
      <View
        style={[
          avatarStyles.circle,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: avatarColors.bg,
          },
        ]}
      >
        <Text
          style={[
            avatarStyles.initials,
            { color: avatarColors.fg, fontSize: initialsSize },
          ]}
        >
          {getInitials(name)}
        </Text>
      </View>
      <RoleAvatarBadge role={role} size={badgeSize} />
      {presenceBadge}
    </View>
  );
}

function getAvatarPresenceColor(
  status?: PresenceDisplayStatus | string | null,
): string | null {
  if (status === 'online') return '#22c55e';
  if (status === 'away' || status === 'idle') return '#eab308';
  if (
    status === 'busy' ||
    status === 'in_class' ||
    status === 'teaching' ||
    status === 'reviewing_work'
  ) {
    return '#dc2626';
  }
  if (status === 'offline') return '#4b5563';
  return null;
}

const avatarStyles = StyleSheet.create({
  wrap: { position: 'relative' },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0 },
  presenceBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});

// Deterministic color per sender name (Slack-style)
const NAME_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];
export function senderColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
}

type S = ReturnType<typeof makeStyles>;

// ─── Emoji-only detection (mirrors web shouldHideMessageQuickActions) ─────────

const EMOJI_ONLY_RE =
  /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?(?:\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?)*)/gu;

export function isEmojiOnlyText(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.length > 0 &&
    trimmed.replace(EMOJI_ONLY_RE, '').replace(/\s+/g, '').length === 0
  );
}

// ─── Inline text formatting (bold / italic / mentions) ───────────────────────

type FmtSegment =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'italic'; value: string }
  | { kind: 'mention'; value: string };

function buildFmtSegments(text: string, mentions?: MessageMentionVM[]): FmtSegment[] {
  const rawParts: Array<{ isText: boolean; value: string }> = [];

  if (mentions && mentions.length > 0) {
    const sorted = [...mentions].sort((a, b) => a.start - b.start);
    let cur = 0;
    for (const m of sorted) {
      if (m.start > cur) rawParts.push({ isText: true, value: text.slice(cur, m.start) });
      rawParts.push({ isText: false, value: `@${m.displayName}` });
      cur = m.end;
    }
    if (cur < text.length) rawParts.push({ isText: true, value: text.slice(cur) });
  } else {
    rawParts.push({ isText: true, value: text });
  }

  const segs: FmtSegment[] = [];
  const RE = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  for (const part of rawParts) {
    if (!part.isText) {
      segs.push({ kind: 'mention', value: part.value });
      continue;
    }
    RE.lastIndex = 0;
    let cur = 0;
    let m: RegExpExecArray | null;
    while ((m = RE.exec(part.value)) !== null) {
      if (m.index > cur)
        segs.push({ kind: 'text', value: part.value.slice(cur, m.index) });
      if (typeof m[2] === 'string') segs.push({ kind: 'bold', value: m[2] });
      else if (typeof m[3] === 'string') segs.push({ kind: 'italic', value: m[3] });
      cur = m.index + m[0].length;
    }
    if (cur < part.value.length)
      segs.push({ kind: 'text', value: part.value.slice(cur) });
  }
  return segs;
}

function FormattedText({
  text,
  mentions,
  style,
  isOwn: _isOwn,
}: {
  text: string;
  mentions?: MessageMentionVM[];
  style?: StyleProp<TextStyle>;
  isOwn?: boolean;
}) {
  const { colors } = useTheme();
  const segs = buildFmtSegments(text, mentions);
  const mentionBg = colors.tealBg;
  const mentionColor = colors.teal;
  return (
    <Text testID="message-text-content" style={style}>
      {segs.map((seg, i) => {
        if (seg.kind === 'bold')
          return (
            <Text key={i} style={{ fontWeight: '700' }}>
              {seg.value}
            </Text>
          );
        if (seg.kind === 'italic')
          return (
            <Text key={i} style={{ fontStyle: 'italic' }}>
              {seg.value}
            </Text>
          );
        if (seg.kind === 'mention')
          return (
            <Text
              key={i}
              style={{
                backgroundColor: mentionBg,
                color: mentionColor,
                fontWeight: '600',
              }}
            >
              {` ${seg.value} `}
            </Text>
          );
        return <Text key={i}>{seg.value}</Text>;
      })}
    </Text>
  );
}

// ─── Social bar: reactions + thread pill in one row ──────────────────────────

type SocialBarProps = {
  reactions: ReactionVM[];
  thread: ThreadVM | null;
  threadUnreadCount?: number;
  messageId: string;
  colors: AppColors;
  onReactionToggle?: (messageId: string, emoji: string) => void;
  onThreadPress?: () => void;
  threadExpanded?: boolean;
  hideActions?: boolean;
  /** When true, emoji + reply buttons are shown but grayed-out and non-interactive. */
  disabledActions?: boolean;
  /** When true, the thread pill and reply button are hidden (used in thread replies). */
  hideThreadButton?: boolean;
  replyButtonLabel?: string;
  showActionControls?: boolean;
};

export function SocialBar({
  reactions,
  thread,
  threadUnreadCount,
  messageId,
  colors,
  onReactionToggle,
  onThreadPress,
  threadExpanded,
  hideActions,
  disabledActions,
  hideThreadButton,
  replyButtonLabel,
  showActionControls = true,
}: SocialBarProps) {
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const hasThread = !!thread && thread.stats.messageCount > 0;
  const showsActionButtons = !hideActions && showActionControls;
  const showsThreadPill = hasThread && !hideThreadButton;

  if (!reactions.length && !showsActionButtons && !showsThreadPill) {
    return null;
  }

  const actionBtnStyle = {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
          marginTop: 4,
          minHeight: showsActionButtons || showsThreadPill ? 30 : undefined,
          alignItems: 'center',
        }}
      >
        {/* Existing reaction pills */}
        {reactions.map((r) => (
          <TouchableOpacity
            key={r.emoji}
            onPress={() => onReactionToggle?.(messageId, r.emoji)}
            activeOpacity={0.75}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: r.reactedByMe ? colors.tealBg : colors.pageBg,
              borderWidth: 1,
              borderColor: r.reactedByMe ? colors.teal : colors.border,
              borderRadius: 20,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <Text style={{ fontSize: 15 }}>{r.emoji}</Text>
            <Text
              style={{
                fontSize: 13,
                color: r.reactedByMe ? colors.teal : colors.text,
                fontWeight: '600',
              }}
            >
              {r.count}
            </Text>
          </TouchableOpacity>
        ))}

        {showsActionButtons && (
          <>
            {/* Emoji reaction add button */}
            <TouchableOpacity
              onPress={disabledActions ? undefined : () => setEmojiPickerVisible(true)}
              activeOpacity={disabledActions ? 1 : 0.7}
              style={[actionBtnStyle, disabledActions && { opacity: 0.4 }]}
              accessibilityLabel="Add emoji reaction"
              accessibilityState={{ disabled: disabledActions ?? false }}
            >
              <SmilePlus size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Thread pill if exists, reply button if not — hidden inside thread view */}
            {!hideThreadButton &&
              (hasThread ? (
                <ThreadPill
                  thread={thread!}
                  colors={colors}
                  onPress={disabledActions ? () => {} : (onThreadPress ?? (() => {}))}
                  expanded={threadExpanded}
                  unreadCount={threadUnreadCount}
                />
              ) : (
                <ThreadReplyButton
                  colors={colors}
                  onPress={onThreadPress}
                  disabled={disabledActions ?? false}
                  inline
                  label={replyButtonLabel}
                />
              ))}
          </>
        )}

        {/* Thread pill always visible when thread exists, unless inside a thread. */}
        {!showsActionButtons && showsThreadPill && (
          <ThreadPill
            thread={thread!}
            colors={colors}
            onPress={disabledActions ? () => {} : (onThreadPress ?? (() => {}))}
            expanded={threadExpanded}
            unreadCount={threadUnreadCount}
          />
        )}
      </View>

      <EmojiPicker
        visible={emojiPickerVisible}
        onClose={() => setEmojiPickerVisible(false)}
        onEmojiSelect={(emoji) => {
          onReactionToggle?.(messageId, emoji);
        }}
      />
    </>
  );
}

// ─── Thread pill ──────────────────────────────────────────────────────────────

function ThreadPill({
  thread,
  colors,
  onPress,
  expanded,
  unreadCount,
}: {
  thread: ThreadVM;
  colors: AppColors;
  onPress: () => void;
  expanded?: boolean;
  unreadCount?: number;
}) {
  const count = thread.stats.messageCount;
  const participants = thread.participants.slice(0, 3);
  const resolvedUnreadCount = unreadCount ?? thread.readState?.unreadCount ?? 0;
  const hasUnread = resolvedUnreadCount > 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: expanded ? colors.tealBg : colors.pageBg,
        borderWidth: 1,
        borderColor: expanded ? colors.teal : colors.border,
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      {/* Chat bubble icon */}
      <MessageCircle size={13} color={expanded ? colors.teal : colors.textMuted} />

      {/* Reply count */}
      <Text
        style={{
          fontSize: 13,
          color: expanded ? colors.teal : colors.textMuted,
          fontWeight: '600',
        }}
      >
        {count} {count === 1 ? 'reply' : 'replies'}
      </Text>

      {hasUnread && (
        <View
          testID="thread-unread-new-badge"
          style={{
            borderRadius: 999,
            paddingHorizontal: 6,
            paddingVertical: 2,
            backgroundColor: colors.tealBg,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              lineHeight: 13,
              fontWeight: '700',
              color: colors.teal,
              textTransform: 'uppercase',
            }}
          >
            New
          </Text>
        </View>
      )}

      {hasUnread && (
        <View
          testID="thread-unread-count-badge"
          style={{
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            paddingHorizontal: 6,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.teal,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              lineHeight: 14,
              fontWeight: '700',
              color: colors.tealFg,
            }}
          >
            {resolvedUnreadCount}
          </Text>
        </View>
      )}

      {/* Overlapping participant initials/avatars */}
      {participants.length > 0 && (
        <View style={{ flexDirection: 'row', marginLeft: 2 }}>
          {participants.map((p, i) => {
            const name = p.profile.displayName;
            const avatarProfile = p.profile as {
              avatar?: { source?: string; url?: string | null; seed?: string | null };
              kind?: string | null;
              ui?: { themeKey?: string | null } | null;
            };
            const src =
              avatarProfile.avatar?.source === 'url'
                ? (avatarProfile.avatar.url ?? null)
                : null;
            const seed =
              avatarProfile.avatar?.source === 'seed'
                ? (avatarProfile.avatar.seed ?? p.ids.id)
                : p.ids.id;
            const avatarColors = profileAvatarColors({
              seed,
              themeKey: avatarProfile.ui?.themeKey,
            });
            return src ? (
              <View
                key={p.ids.id}
                style={{
                  width: 20,
                  height: 20,
                  marginLeft: i > 0 ? -6 : 0,
                  zIndex: participants.length - i,
                  position: 'relative',
                }}
              >
                <Image
                  source={{ uri: src }}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: colors.pageBg,
                  }}
                />
                <RoleAvatarBadge
                  role={avatarProfile.kind}
                  size={10}
                  style={{ top: -2 }}
                />
              </View>
            ) : (
              <View
                key={p.ids.id}
                style={{
                  width: 20,
                  height: 20,
                  marginLeft: i > 0 ? -6 : 0,
                  zIndex: participants.length - i,
                  position: 'relative',
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: avatarColors.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1.5,
                    borderColor: colors.pageBg,
                  }}
                >
                  <Text
                    style={{ color: avatarColors.fg, fontSize: 9, fontWeight: '700' }}
                  >
                    {getInitials(name)[0]}
                  </Text>
                </View>
                <RoleAvatarBadge
                  role={avatarProfile.kind}
                  size={10}
                  style={{ top: -2 }}
                />
              </View>
            );
          })}
        </View>
      )}
    </TouchableOpacity>
  );
}

export function findInlineUnreadStartIndex(input: {
  replies: MessageVM[];
  lastReadMessageId?: string;
  unreadCount?: number;
  currentUserId?: string;
}): number {
  const { replies, lastReadMessageId, unreadCount, currentUserId } = input;
  const normalizedUnreadCount = Math.max(0, unreadCount ?? 0);
  if (replies.length === 0) return -1;

  const findIncomingIndex = (startIndex: number): number => {
    for (let index = startIndex; index < replies.length; index += 1) {
      const reply = replies[index];
      if (!currentUserId || reply.core.sender.ids.id !== currentUserId) {
        return index;
      }
    }
    return -1;
  };

  if (lastReadMessageId) {
    const lastReadIndex = replies.findIndex(
      (reply) => reply.ids.id === lastReadMessageId,
    );
    if (lastReadIndex >= 0) {
      return findIncomingIndex(lastReadIndex + 1);
    }
  }

  if (normalizedUnreadCount <= 0) return -1;
  return findIncomingIndex(Math.max(0, replies.length - normalizedUnreadCount));
}

function InlineUnreadDivider({ count, colors }: { count?: number; colors: AppColors }) {
  const label = count && count > 0 ? `New messages (${count})` : 'New messages';
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8, gap: 8 }}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <View
        style={{
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.inputBg,
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 4,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            color: colors.textMuted,
          }}
        >
          {label}
        </Text>
      </View>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}

function getVisibilityLabel(message: MessageVM): string | null {
  const visibility = message.core.visibility;
  if (visibility.type === 'all') return null;
  if (visibility.type === 'sender-only') return 'Only visible to you';
  if (visibility.type === 'recipient-only') return 'Only visible to recipient';
  if (visibility.type === 'specific-users') return 'Visible to specific users';
  return 'Private';
}

export function VisibilityBadge({
  message,
  colors,
}: {
  message: MessageVM;
  colors: AppColors;
}) {
  const label = getVisibilityLabel(message);
  if (!label) return null;

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger accessibilityRole="button" accessibilityLabel={label} hitSlop={8}>
        <View
          testID="message-visibility-badge"
          style={[
            visibilityBadgeStyles.badge,
            {
              backgroundColor: colors.inputBg,
              borderColor: colors.border,
            },
          ]}
        >
          <EyeOff size={10} color={colors.textMuted} />
        </View>
      </TooltipTrigger>
      <TooltipContent sideOffset={6} className="rounded-full px-2.5 py-1">
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#f8fafc' }}>{label}</Text>
      </TooltipContent>
    </Tooltip>
  );
}

const visibilityBadgeStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
});

// ─── Inline thread reply (compact) ────────────────────────────────────────────

function InlineReply({
  message,
  colors,
  currentProfileId,
}: {
  message: MessageVM;
  colors: AppColors;
  currentProfileId?: string;
}) {
  const senderName = message.core.sender.profile.displayName;
  const isOwn = !!currentProfileId && message.core.sender.ids.id === currentProfileId;
  const displayName = isOwn ? 'You' : senderName;
  const nameColor = isOwn ? colors.textMuted : senderColor(senderName);
  const time = formatTime(message.core.createdAt);
  const { url: src, seed } = getAvatarInfo(message);
  const senderRole = message.core.sender.kind;
  const senderThemeKey = message.core.sender.ui?.themeKey;
  const text = (message as { content?: { text?: string } }).content?.text ?? '';
  const mentions = (message as { content?: { mentions?: MessageMentionVM[] } }).content
    ?.mentions;

  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
      <MessageAvatar
        name={senderName}
        src={src}
        seed={seed}
        role={senderRole}
        themeKey={senderThemeKey}
        size={28}
        badgeSizeOverride={12}
      />
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            gap: 6,
            alignItems: 'baseline',
            marginBottom: 2,
          }}
        >
          <RoleNameIndicator
            name={displayName}
            role={senderRole}
            iconSize={12}
            textStyle={{
              fontSize: 14,
              fontWeight: '700',
              color: nameColor,
            }}
          />
          <Text style={{ fontSize: 12, color: colors.textFaint }}>{time}</Text>
        </View>
        <FormattedText
          text={text}
          mentions={mentions}
          style={{ fontSize: 15, color: colors.text, lineHeight: 20 }}
        />
      </View>
    </View>
  );
}

export function ThreadReplyButton({
  colors,
  onPress,
  disabled,
  inline = false,
  label,
}: {
  colors: AppColors;
  onPress?: () => void;
  disabled?: boolean;
  inline?: boolean;
  label?: string;
}) {
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.75}
      accessibilityLabel="Reply to thread"
      accessibilityState={{ disabled: disabled ?? false }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: inline ? 'auto' : 'flex-start',
        marginTop: inline ? 0 : 8,
        paddingHorizontal: 8,
        paddingVertical: inline ? 4 : 5,
        borderRadius: 18,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        backgroundColor: colors.card,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <CornerUpLeft size={14} color={colors.textMuted} />
      {label ? (
        <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '600' }}>
          {label}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Card sub-renderers ───────────────────────────────────────────────────────

function CardHeader({
  icon: Icon,
  label,
  tag,
  colors,
  s,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  tag?: string;
  colors: AppColors;
  s: S;
}) {
  return (
    <View style={s.cardHeader}>
      <Icon size={16} color={colors.teal} />
      <Text style={[s.cardHeaderLabel, { color: colors.teal }]}>{label}</Text>
      {!!tag && (
        <View style={[s.subjectTag, { backgroundColor: colors.tealBg }]}>
          <Text style={[s.subjectTagText, { color: colors.teal }]}>{tag}</Text>
        </View>
      )}
    </View>
  );
}

function AssignmentCard({
  message,
  colors,
  s,
}: {
  message: LessonAssignmentMessageVM;
  colors: AppColors;
  s: S;
}) {
  const { assignment } = message;
  const diffColor =
    { beginner: '#22c55e', intermediate: '#f59e0b', advanced: '#ef4444' }[
      assignment.difficulty ?? 'intermediate'
    ] ?? colors.textMuted;
  return (
    <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <CardHeader
        icon={BookOpenCheck}
        label="Assignment"
        tag={assignment.subject}
        colors={colors}
        s={s}
      />
      <Text style={[s.cardTitle, { color: colors.text }]}>{assignment.title}</Text>
      <Text style={[s.cardDesc, { color: colors.textMuted }]}>
        {assignment.description}
      </Text>
      <View style={s.cardMeta}>
        <Text style={[s.metaChip, { color: colors.textMuted }]}>
          Due {formatDate(assignment.dueAt)}
        </Text>
        {!!assignment.estimatedDuration && (
          <Text style={[s.metaChip, { color: colors.textMuted }]}>
            {assignment.estimatedDuration} min
          </Text>
        )}
        {!!assignment.difficulty && (
          <Text style={[s.metaChip, { color: diffColor, fontWeight: '600' }]}>
            {assignment.difficulty[0]!.toUpperCase() + assignment.difficulty.slice(1)}
          </Text>
        )}
      </View>
      {assignment.attachments?.map((att, i) => (
        <View key={i} style={[s.attachRow, { borderColor: colors.border }]}>
          <FileText size={14} color={colors.textMuted} />
          <Text style={[s.attachName, { color: colors.text }]} numberOfLines={1}>
            {att.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SessionSummaryCard({
  message,
  colors,
  s,
}: {
  message: SessionSummaryMessageVM;
  colors: AppColors;
  s: S;
}) {
  const { session } = message;
  return (
    <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <CardHeader icon={ClipboardList} label="Session Summary" colors={colors} s={s} />
      <Text style={[s.cardTitle, { color: colors.text }]}>{session.title}</Text>
      <Text style={[s.metaChip, { color: colors.textMuted, marginBottom: 4 }]}>
        {formatDate(session.startAt)}
        {session.durationMinutes ? ` · ${session.durationMinutes} min` : ''}
      </Text>
      <Text style={[s.cardDesc, { color: colors.textMuted }]}>{session.summary}</Text>
      {!!session.highlights?.length && (
        <View style={{ marginTop: 10 }}>
          <Text style={[s.sectionLabel, { color: colors.text }]}>Highlights</Text>
          {session.highlights.map((h, i) => (
            <Text key={i} style={[s.listItem, { color: colors.textMuted }]}>
              ✓ {h}
            </Text>
          ))}
        </View>
      )}
      {!!session.nextSteps?.length && (
        <View style={{ marginTop: 8 }}>
          <Text style={[s.sectionLabel, { color: colors.text }]}>Next Steps</Text>
          {session.nextSteps.map((step, i) => (
            <Text key={i} style={[s.listItem, { color: colors.textMuted }]}>
              → {step}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function ProgressCard({
  message,
  colors,
  s,
}: {
  message: ProgressUpdateMessageVM;
  colors: AppColors;
  s: S;
}) {
  const { progress } = message;
  const target = progress.targetValue ?? Math.max(progress.currentValue * 1.3, 100);
  const currRatio = Math.min(progress.currentValue / target, 1);
  return (
    <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <CardHeader
        icon={TrendingUp}
        label="Progress Update"
        tag={progress.subject}
        colors={colors}
        s={s}
      />
      <Text style={[s.cardTitle, { color: colors.text }]}>{progress.metric}</Text>
      <View style={{ marginVertical: 10 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>
            Before: {progress.previousValue}%
          </Text>
          <Text style={{ color: colors.teal, fontSize: 14, fontWeight: '700' }}>
            Now: {progress.currentValue}%
          </Text>
        </View>
        <View style={[s.progressTrack, { backgroundColor: colors.inputBg }]}>
          <View
            style={[
              s.progressFill,
              {
                width: `${Math.round(currRatio * 100)}%` as `${number}%`,
                backgroundColor: colors.teal,
              },
            ]}
          />
        </View>
        {!!progress.targetValue && (
          <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 4 }}>
            Target: {progress.targetValue}%
          </Text>
        )}
      </View>
      <View style={[s.improvementBadge, { backgroundColor: colors.tealBg }]}>
        <Text style={{ color: colors.teal, fontWeight: '700', fontSize: 14 }}>
          +{progress.improvement} improvement
        </Text>
      </View>
      <Text style={[s.cardDesc, { color: colors.textMuted, marginTop: 8 }]}>
        {progress.summary}
      </Text>
    </View>
  );
}

function EventCard({
  message,
  colors,
  s,
}: {
  message: EventReminderMessageVM;
  colors: AppColors;
  s: S;
}) {
  const { event } = message;
  return (
    <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <CardHeader icon={CalendarDays} label="Event Reminder" colors={colors} s={s} />
      <Text style={[s.cardTitle, { color: colors.text }]}>{event.title}</Text>
      <Text style={[s.metaChip, { color: colors.textMuted }]}>
        {formatDate(event.startAt)} · {formatTime(event.startAt)}
        {event.endAt ? ` – ${formatTime(event.endAt)}` : ''}
      </Text>
      {!!event.location && (
        <View style={s.metaRow}>
          <LocateFixed size={13} color={colors.textMuted} />
          <Text style={[s.metaChip, { color: colors.textMuted }]}>{event.location}</Text>
        </View>
      )}
      {!!event.meetingLink && (
        <TouchableOpacity
          style={[s.joinBtn, { backgroundColor: colors.teal }]}
          onPress={() => Linking.openURL(event.meetingLink!).catch(() => null)}
        >
          <Text style={{ color: colors.tealFg, fontWeight: '700', fontSize: 14 }}>
            Join Meeting
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function HomeworkCard({
  message,
  colors,
  s,
}: {
  message: HomeworkSubmissionMessageVM;
  colors: AppColors;
  s: S;
}) {
  const { homework } = message;
  const statusColor =
    homework.status === 'graded'
      ? '#22c55e'
      : homework.status === 'needs-revision'
        ? '#f59e0b'
        : colors.teal;
  const statusLabel = {
    submitted: 'Submitted',
    graded: 'Graded',
    'needs-revision': 'Needs Revision',
  }[homework.status];
  return (
    <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <CardHeader icon={NotebookPen} label="Homework Submitted" colors={colors} s={s} />
      <Text style={[s.cardTitle, { color: colors.text }]}>
        {homework.assignmentTitle}
      </Text>
      <View style={[s.statusBadge, { backgroundColor: statusColor + '22' }]}>
        <Text style={{ color: statusColor, fontWeight: '600', fontSize: 13 }}>
          {statusLabel}
        </Text>
      </View>
      {homework.attachments.map((att, i) => (
        <View key={i} style={[s.attachRow, { borderColor: colors.border }]}>
          {att.type === 'image' ? (
            <ImageIcon size={14} color={colors.textMuted} />
          ) : (
            <FileText size={14} color={colors.textMuted} />
          )}
          <Text style={[s.attachName, { color: colors.text }]} numberOfLines={1}>
            {att.name}
          </Text>
        </View>
      ))}
      {!!homework.grade && (
        <Text style={[s.metaChip, { color: colors.textMuted, marginTop: 6 }]}>
          Grade: {homework.grade}
        </Text>
      )}
      {!!homework.feedback && (
        <Text style={[s.cardDesc, { color: colors.textMuted }]}>{homework.feedback}</Text>
      )}
    </View>
  );
}

function FeedbackRequestCard({
  message,
  colors,
  s,
}: {
  message: FeedbackRequestMessageVM;
  colors: AppColors;
  s: S;
}) {
  const prompt = message.feedback?.prompt ?? message.content?.text ?? '';
  const rating = message.feedback?.rating;
  const comment = message.feedback?.comment;
  return (
    <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <CardHeader
        icon={MessageSquareText}
        label="Feedback Request"
        tag={message.feedback?.sessionTitle ?? undefined}
        colors={colors}
        s={s}
      />
      {!!prompt && (
        <Text style={[s.cardDesc, { color: colors.textMuted }]}>{prompt}</Text>
      )}
      {rating !== null && rating !== undefined && (
        <Text style={[s.metaChip, { color: colors.textMuted, marginTop: 4 }]}>
          {'★'.repeat(rating)}
          {'☆'.repeat(Math.max(0, 5 - rating))} {rating}/5
        </Text>
      )}
      {!!comment && (
        <Text style={[s.cardDesc, { color: colors.textMuted, marginTop: 4 }]}>
          {comment}
        </Text>
      )}
    </View>
  );
}

function SessionBookingCard({
  message,
  colors,
  s,
}: {
  message: SessionBookingMessageVM;
  colors: AppColors;
  s: S;
}) {
  const { session } = message;
  const statusColor =
    {
      scheduled: colors.textMuted,
      confirmed: '#22c55e',
      cancelled: '#ef4444',
      completed: colors.teal,
    }[session.status] ?? colors.textMuted;
  const statusLabel = {
    scheduled: 'Scheduled',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    completed: 'Completed',
  }[session.status];
  return (
    <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <CardHeader
        icon={GraduationCap}
        label="Session Booked"
        tag={session.subject}
        colors={colors}
        s={s}
      />
      <Text style={[s.cardTitle, { color: colors.text }]}>{session.title}</Text>
      <Text style={[s.metaChip, { color: colors.textMuted }]}>
        {formatDate(session.startAt)} · {formatTime(session.startAt)}
        {session.durationMinutes ? ` · ${session.durationMinutes} min` : ''}
      </Text>
      <View style={[s.statusBadge, { backgroundColor: statusColor + '22' }]}>
        <Text style={{ color: statusColor, fontWeight: '600', fontSize: 13 }}>
          {statusLabel}
        </Text>
      </View>
      {!!session.meetingLink && (
        <TouchableOpacity
          style={[s.joinBtn, { backgroundColor: colors.teal }]}
          onPress={() => Linking.openURL(session.meetingLink!).catch(() => null)}
        >
          <Text style={{ color: colors.tealFg, fontWeight: '700', fontSize: 14 }}>
            Join Meeting
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function PaymentReminderCard({
  message,
  colors,
  s,
}: {
  message: PaymentReminderMessageVM;
  colors: AppColors;
  s: S;
}) {
  const { payment } = message;
  const statusColor =
    { pending: '#f59e0b', paid: '#22c55e', overdue: '#ef4444' }[payment.status] ??
    colors.textMuted;
  const statusLabel = { pending: 'Pending', paid: 'Paid', overdue: 'Overdue' }[
    payment.status
  ];
  return (
    <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <CardHeader icon={CreditCard} label="Payment Reminder" colors={colors} s={s} />
      <Text style={[s.cardTitle, { color: colors.text }]}>
        {payment.currency} {payment.amount.toLocaleString()}
      </Text>
      <View style={[s.statusBadge, { backgroundColor: statusColor + '22' }]}>
        <Text style={{ color: statusColor, fontWeight: '600', fontSize: 13 }}>
          {statusLabel}
        </Text>
      </View>
      <Text style={[s.metaChip, { color: colors.textMuted, marginTop: 6 }]}>
        Due {formatDate(payment.dueAt)}
      </Text>
      {!!payment.description && (
        <Text style={[s.cardDesc, { color: colors.textMuted }]}>
          {payment.description}
        </Text>
      )}
    </View>
  );
}

function SessionCompleteBar({
  message,
  colors,
  s,
}: {
  message: SessionCompleteMessageVM;
  colors: AppColors;
  s: S;
}) {
  return (
    <View style={s.sessionCompleteRow}>
      <View style={[s.sessionCompleteLine, { backgroundColor: colors.border }]} />
      <View style={s.sessionCompleteCenter}>
        <View
          style={[
            s.sessionCompleteIcon,
            { backgroundColor: colors.tealBg, borderColor: colors.teal },
          ]}
        >
          <Check size={14} color={colors.teal} />
        </View>
        <Text
          style={[s.sessionCompleteTitle, { color: colors.textMuted }]}
          numberOfLines={2}
        >
          {message.session.title}
        </Text>
        {!!message.session.endAt && (
          <Text style={{ fontSize: 11, color: colors.textFaint }}>
            {formatTime(message.session.endAt)}
          </Text>
        )}
      </View>
      <View style={[s.sessionCompleteLine, { backgroundColor: colors.border }]} />
    </View>
  );
}

// ─── LiveSessionStartedCard ───────────────────────────────────────────────────

const DEFAULT_LIVE_SESSION_DURATION_MS = 30 * 60 * 1000;

function isLiveSessionEnded(msg: LiveSessionStartedMessageVM): boolean {
  const ls = msg.liveSession;
  if (!ls) return true;
  if (ls.status === 'ended') return true;
  const startedAt = Date.parse(ls.startedAt);
  const endsAt = ls.endsAt ? Date.parse(ls.endsAt) : NaN;
  const effectiveEndsAt = Number.isFinite(endsAt)
    ? endsAt
    : Number.isFinite(startedAt)
      ? startedAt + DEFAULT_LIVE_SESSION_DURATION_MS
      : NaN;
  return Number.isFinite(effectiveEndsAt) && effectiveEndsAt <= Date.now();
}

function LiveSessionStartedCard({
  message,
  colors,
  s,
}: {
  message: LiveSessionStartedMessageVM;
  colors: AppColors;
  s: S;
}) {
  // Business logic mirrors packages/ui-web/.../live-session-started-message.utils.ts
  const liveSession = message.liveSession as
    | {
        status?: string;
        title?: string;
        startedByDisplayName?: string;
        provider?: string;
        joinUrl?: string;
        occurrenceLabel?: string;
        endsAt?: string;
        startedAt?: string;
      }
    | undefined;

  const ended = isLiveSessionEnded(message);
  const title = ended ? 'Class ended' : (liveSession?.title ?? 'Live session');
  const buttonLabel = ended ? 'Class ended' : 'Join';

  return (
    <View
      style={[
        s.card,
        {
          borderColor: colors.border,
          backgroundColor: ended ? colors.inputBg : colors.card,
          gap: 12,
        },
      ]}
    >
      {/* Title + description + occurrence — mirrors web space-y-1 block */}
      <View style={{ gap: 4 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '600',
            color: ended ? colors.textMuted : colors.text,
          }}
        >
          {title}
        </Text>
        {!!liveSession && (
          <>
            <Text style={{ fontSize: 15, color: colors.textMuted }}>
              {liveSession.startedByDisplayName}{' '}
              {ended
                ? `ended this ${liveSession.provider ?? ''} live session.`
                : `started this ${liveSession.provider ?? ''} live session.`}
            </Text>
            {!!liveSession.occurrenceLabel && (
              <Text style={{ fontSize: 13, color: colors.textMuted }}>
                For {liveSession.occurrenceLabel}
              </Text>
            )}
          </>
        )}
      </View>

      {/* Join / Ended button — mirrors web <Button size="sm" variant={ended ? 'outline' : 'default'}> */}
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          alignSelf: 'flex-start',
          borderRadius: 8,
          paddingVertical: 7,
          paddingHorizontal: 14,
          backgroundColor: ended ? colors.inputBg : colors.teal,
          borderWidth: ended ? 1 : 0,
          borderColor: colors.border,
        }}
        disabled={ended}
        activeOpacity={0.8}
        onPress={() => {
          if (!ended && liveSession?.joinUrl) {
            Linking.openURL(liveSession.joinUrl).catch(() => null);
          }
        }}
      >
        <Video size={16} color={ended ? colors.textMuted : colors.tealFg} />
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: ended ? colors.textMuted : colors.tealFg,
          }}
        >
          {buttonLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles factory ───────────────────────────────────────────────────────────

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    // ── Outer row: avatar + content, aligned to top ──────────────────────────
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 2,
      gap: 12,
    },
    rowOwn: { flexDirection: 'row-reverse' },
    rowGroupStart: { paddingTop: 10 },

    // ── Avatar slot (always 36px to reserve space) ───────────────────────────
    avatarSlot: { width: 36, flexShrink: 0, alignItems: 'center' },

    // ── Content column ────────────────────────────────────────────────────────
    contentCol: { flex: 1, alignItems: 'flex-start', gap: 3 },
    contentColOwn: { alignItems: 'flex-end' },

    // ── Name + time row (inside bubble) ──────────────────────────────────────
    nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 2 },
    nameRowOwn: { justifyContent: 'flex-end' },
    senderName: { fontSize: 15, fontWeight: '700' },
    msgTime: { fontSize: 12, color: colors.textFaint },

    // ── Message bubble ────────────────────────────────────────────────────────
    bubble: {
      width: '85%',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    bubbleOther: {
      backgroundColor: 'rgba(148, 163, 184, 0.16)',
    },
    bubbleOwn: {
      backgroundColor: 'rgba(45, 212, 168, 0.22)',
    },

    // ── Text inside bubble ────────────────────────────────────────────────────
    textContent: {
      width: '100%',
      flexShrink: 1,
      flexWrap: 'wrap',
      fontSize: 15,
      lineHeight: 20,
      color: colors.text,
    },
    textContentOwn: { color: colors.text },
    emojiOnlyTextContent: {
      fontSize: 36,
      lineHeight: 42,
    },

    // ── File attachment ────────────────────────────────────────────────────────
    // width:'85%' (not maxWidth) gives a definite pixel width → flex:1 inside rows resolves
    fileBubble: {
      width: '85%' as const,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    fileCaptionBubble: {
      width: '85%' as const,
      maxWidth: '85%' as const,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    // File list: standalone card matching web "max-w-sm rounded-xl border border-border bg-muted/30"
    fileListWrap: {
      width: '85%' as const,
      borderWidth: 1,
      borderRadius: 12,
      overflow: 'hidden',
    },
    fileRowPadded: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
    // Icon: matches web "h-10 w-10 bg-primary/10 rounded-md"
    fileIcon: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: colors.tealBg,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Audio player — inner card matches web: rounded-2xl border bg-card px-3 py-3 ──
    audioCard: {
      borderWidth: 1,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    audioRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    playBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Waveform container: h-6 (24pt) with inner padding to match web rounded-xl border bg-muted/70 px-2
    waveformRow: {
      flexDirection: 'row' as const,
      alignItems: 'flex-end' as const,
      gap: 2,
      height: 24,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'transparent',
      paddingHorizontal: 4,
    },

    // ── Image message (matches web: rounded-xl, border, download btn overlay) ──
    imageWrapper: {
      maxWidth: 320,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    imageGalleryWrapper: {
      maxWidth: '90%',
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: 8,
    },
    imageCaption: { marginBottom: 6 },
    imagePreview: { width: '100%' },
    galleryItem: {
      width: '48%',
      height: 192,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    galleryItemImg: { width: '100%', height: '100%' },
    imageDownloadBtn: {
      position: 'absolute' as const,
      top: 12,
      right: 12,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },

    // ── Link preview card ──────────────────────────────────────────────────────
    // width set inline as '85%' so the card is a direct child of contentCol — flex:1 inside resolves
    linkCard: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
    linkCardImgWrapper: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: colors.card,
      overflow: 'hidden',
    },
    linkCardImg: { width: '100%', height: '100%' },
    linkCardBody: { padding: 12 },
    linkCardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
    linkCardDesc: { fontSize: 13, lineHeight: 17 },
    linkCardMeta: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      marginTop: 8,
    },
    linkCardFavicon: { width: 12, height: 12 },
    linkCardSite: { fontSize: 13, flex: 1 },

    // ── Structured cards (self-contained, no outer bubble) ────────────────────
    card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 4 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    cardHeaderLabel: { fontSize: 14, fontWeight: '700', flex: 1 },
    subjectTag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
    subjectTagText: { fontSize: 12, fontWeight: '600' },
    cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 2 },
    cardDesc: { fontSize: 14, lineHeight: 19 },
    cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    metaChip: { fontSize: 13 },
    sectionLabel: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
    listItem: { fontSize: 14, lineHeight: 19 },
    attachRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderTopWidth: 1,
      paddingTop: 8,
      marginTop: 8,
    },
    attachName: { flex: 1, fontSize: 13, fontWeight: '500' },
    joinBtn: {
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: 10,
    },
    statusBadge: {
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: 'flex-start',
      marginTop: 4,
    },
    progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
    progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
    improvementBadge: {
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: 'flex-start',
      marginTop: 4,
    },

    // ── Session complete divider ───────────────────────────────────────────────
    sessionCompleteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 10,
    },
    sessionCompleteLine: { flex: 1, height: 1 },
    sessionCompleteCenter: { alignItems: 'center', gap: 4 },
    sessionCompleteIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sessionCompleteTitle: {
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      maxWidth: 160,
    },

    // ── Inline thread expansion ────────────────────────────────────────────────
    inlineThread: { flexDirection: 'row', marginTop: 6 },
    // For own (right-aligned) messages: push thread to the right half so it
    // sits beneath the bubble rather than spanning the full content column.
    inlineThreadOwn: { alignSelf: 'stretch', marginLeft: '25%' },
    threadLine: {
      width: 2,
      borderRadius: 1,
      alignSelf: 'stretch',
      marginLeft: 2,
      marginRight: 8,
    },
    inlineReplies: { flex: 1 },
  });
}

// ─── Card type set ────────────────────────────────────────────────────────────

const CARD_TYPES = new Set([
  'lesson-assignment',
  'session-summary',
  'progress-update',
  'event-reminder',
  'homework-submission',
  'feedback-request',
  'session-booking',
  'payment-reminder',
  'live-session-started',
]);

export function isRichMessageType(type: string): boolean {
  return type === 'session-complete' || CARD_TYPES.has(type);
}

export function RichMessageContent({
  message,
  colors,
}: {
  message: MessageVM;
  colors: AppColors;
}) {
  const s = makeStyles(colors);
  const type = message.core.type;

  if (type === 'session-complete') {
    return (
      <SessionCompleteBar
        message={message as SessionCompleteMessageVM}
        colors={colors}
        s={s}
      />
    );
  }

  if (type === 'lesson-assignment') {
    return (
      <AssignmentCard
        message={message as LessonAssignmentMessageVM}
        colors={colors}
        s={s}
      />
    );
  }

  if (type === 'session-summary') {
    return (
      <SessionSummaryCard
        message={message as SessionSummaryMessageVM}
        colors={colors}
        s={s}
      />
    );
  }

  if (type === 'progress-update') {
    return (
      <ProgressCard message={message as ProgressUpdateMessageVM} colors={colors} s={s} />
    );
  }

  if (type === 'event-reminder') {
    return (
      <EventCard message={message as EventReminderMessageVM} colors={colors} s={s} />
    );
  }

  if (type === 'homework-submission') {
    return (
      <HomeworkCard
        message={message as HomeworkSubmissionMessageVM}
        colors={colors}
        s={s}
      />
    );
  }

  if (type === 'feedback-request') {
    return (
      <FeedbackRequestCard
        message={message as FeedbackRequestMessageVM}
        colors={colors}
        s={s}
      />
    );
  }

  if (type === 'session-booking') {
    return (
      <SessionBookingCard
        message={message as SessionBookingMessageVM}
        colors={colors}
        s={s}
      />
    );
  }

  if (type === 'payment-reminder') {
    return (
      <PaymentReminderCard
        message={message as PaymentReminderMessageVM}
        colors={colors}
        s={s}
      />
    );
  }

  if (type === 'live-session-started') {
    return (
      <LiveSessionStartedCard
        message={message as LiveSessionStartedMessageVM}
        colors={colors}
        s={s}
      />
    );
  }

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export type MessageItemProps = {
  message: MessageVM;
  channelId?: string;
  isOwn: boolean;
  isGroupStart: boolean;
  colors: AppColors;
  onLongPress?: (message: MessageVM) => void;
  onReactionToggle?: (messageId: string, emoji: string) => void;
  onThreadOpen?: (message: MessageVM) => void;
  onProfilePress?: (user: MessageVM['core']['sender']) => void;
  currentProfileId?: string;
  currentAccountId?: string;
  isReadOnly?: boolean;
  isThreadMessage?: boolean;
  showActionControls?: boolean;
  onSendAnnotation?: (attachment: AttachmentPayload) => void;
  messageUiThemeKey?: 'classic' | 'feed';
};

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  channelId,
  isOwn,
  isGroupStart,
  colors,
  onLongPress,
  onReactionToggle,
  onThreadOpen,
  onProfilePress,
  currentProfileId,
  currentAccountId,
  isReadOnly,
  isThreadMessage = false,
  showActionControls = true,
  onSendAnnotation,
  messageUiThemeKey = 'classic',
}) => {
  const { markThreadRead } = useMarkRead({
    orgId: message.ids.orgId,
    profileId: currentProfileId ?? '',
    accountId: currentAccountId ?? '',
    channelId: channelId ?? '',
  });
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [threadExpanded, setThreadExpanded] = useState(false);
  const [threadReplies, setThreadReplies] = useState<MessageVM[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadUnreadCount, setThreadUnreadCount] = useState(
    message.social?.thread?.readState?.unreadCount ?? 0,
  );
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioPositionMs, setAudioPositionMs] = useState(0);
  const [audioDurationMs, setAudioDurationMs] = useState(0);
  const soundRef = useRef<AudioPlayer | null>(null);
  const audioSubRef = useRef<{ remove(): void } | null>(null);
  const [openingFile, setOpeningFile] = useState<string | null>(null);
  const [imageSignedUrls, setImageSignedUrls] = useState<Record<string, string>>({});
  const [audioSignedUrl, setAudioSignedUrl] = useState<string | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [pdfViewerDocument, setPdfViewerDocument] = useState<{
    url: string;
    storagePath?: string | null;
    filename?: string | null;
  } | null>(null);

  // Release sound when the message item unmounts
  useEffect(() => {
    return () => {
      audioSubRef.current?.remove();
      soundRef.current?.remove();
    };
  }, []);

  const type = message.core.type;

  // Pre-generate signed URLs for image attachments so <Image> can render them
  useEffect(() => {
    if (type !== 'image') return;
    const im = message as ImageMessageVM;
    const attachments: ImageAttachmentVM[] = im.attachments?.length
      ? im.attachments
      : im.attachment
        ? [im.attachment]
        : [];
    const withPaths = attachments.filter((a) => a.storagePath);
    if (!withPaths.length) return;

    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        withPaths.map(async (att) => {
          const { data, error } = await supabase.storage
            .from(CHANNEL_FILES_BUCKET)
            .createSignedUrl(att.storagePath!, 3600);
          if (!error && data?.signedUrl)
            return [att.storagePath!, data.signedUrl] as [string, string];
          return null;
        }),
      );
      if (cancelled) return;
      setImageSignedUrls(
        Object.fromEntries(entries.filter((e): e is [string, string] => !!e)),
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, message.ids.id]);

  // Pre-generate signed URL for audio so playback works from the private bucket
  useEffect(() => {
    if (type !== 'audio-recording') return;
    const am = message as AudioRecordingMessageVM;
    const storagePath = am.audio.storagePath;
    if (!storagePath) return;

    let cancelled = false;
    supabase.storage
      .from(CHANNEL_FILES_BUCKET)
      .createSignedUrl(storagePath, 3600)
      .then(({ data, error }) => {
        if (!cancelled && !error && data?.signedUrl) {
          setAudioSignedUrl(data.signedUrl);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, message.ids.id]);

  const senderDisplayName = message.core.sender.profile.displayName;
  const { url: avatarUrl, seed: avatarSeed } = getAvatarInfo(message);
  const senderRole = message.core.sender.kind;
  const time = formatTime(message.core.createdAt);
  const reactions = message.social?.reactions ?? [];
  const thread = message.social?.thread ?? null;
  const isFeedTheme = messageUiThemeKey === 'feed';
  const isCard = CARD_TYPES.has(type);
  const msgText = (message as { content?: { text?: string } }).content?.text ?? null;
  const hideActions = msgText !== null && isEmojiOnlyText(msgText);
  const audioMimeType =
    type === 'audio-recording'
      ? ((message as AudioRecordingMessageVM).audio?.mimeType ?? '')
      : '';
  const inlineUnreadStartIndex = findInlineUnreadStartIndex({
    replies: threadReplies,
    lastReadMessageId: thread?.readState?.lastReadMessageId,
    unreadCount: threadUnreadCount,
    currentUserId: currentProfileId,
  });

  useEffect(() => {
    setThreadUnreadCount(thread?.readState?.unreadCount ?? 0);
  }, [thread?.ids.id, thread?.readState?.unreadCount]);

  const loadThreadReplies = useCallback(async () => {
    if (!thread) {
      return;
    }

    setThreadLoading(true);
    try {
      const resolvedChannelId = thread.readState?.channelId ?? channelId ?? '';
      const replies = await fetchThreadMessages(
        message.ids.orgId,
        resolvedChannelId,
        thread.ids.id,
        message.ids.id,
        currentProfileId ?? '',
        currentAccountId ?? '',
      );
      setThreadReplies(replies);
      const lastReplyId = replies[replies.length - 1]?.ids.id ?? null;
      if (resolvedChannelId && currentProfileId && currentAccountId) {
        const alreadyUpToDate =
          threadUnreadCount === 0 && lastReplyId === thread.readState?.lastReadMessageId;
        if (!alreadyUpToDate) {
          await markThreadRead({
            orgId: message.ids.orgId,
            channelId: resolvedChannelId,
            parentMessageId: message.ids.id,
            threadId: thread.ids.id,
            lastReadMessageId: lastReplyId,
          });
        }
      }
    } catch (error) {
      reportMobileObservedError({
        error,
        source: 'mobile.messages.message_item.thread_expand',
        message: 'Failed to load thread replies',
        context: {
          threadId: thread?.ids.id,
          messageId: message.ids.id,
        },
      });
    } finally {
      setThreadLoading(false);
    }
  }, [
    thread,
    channelId,
    message.ids.id,
    message.ids.orgId,
    currentProfileId,
    currentAccountId,
    threadUnreadCount,
    markThreadRead,
  ]);

  useEffect(() => {
    if (!threadExpanded || !thread) {
      return;
    }

    void loadThreadReplies();
  }, [
    threadExpanded,
    thread?.ids.id,
    thread?.stats.messageCount,
    thread?.stats.lastReplyAt,
    loadThreadReplies,
  ]);

  const handleAudioPress = useCallback(
    async (url: string) => {
      if (soundRef.current) {
        // Sound already loaded — toggle play/pause
        if (isAudioPlaying) {
          soundRef.current.pause();
        } else {
          soundRef.current.play();
        }
      } else {
        // First press — load and play
        setAudioLoading(true);
        try {
          await setAudioModeAsync({ playsInSilentMode: true });
          const player = createAudioPlayer({ uri: url });
          audioSubRef.current = player.addListener(
            'playbackStatusUpdate',
            (status: AudioStatus) => {
              setIsAudioPlaying(status.playing);
              setAudioPositionMs(Math.round(status.currentTime * 1000));
              if (status.duration) setAudioDurationMs(Math.round(status.duration * 1000));
              if (status.didJustFinish) {
                // Reset to start after finishing
                soundRef.current?.seekTo(0).catch(() => null);
                setAudioPositionMs(0);
              }
            },
          );
          soundRef.current = player;
          player.play();
          setIsAudioPlaying(true);
        } catch {
          // WebM/Opus (recorded by Chrome on web) is not supported by iOS AVFoundation.
          // Show a targeted message so the user understands why it failed.
          if (Platform.OS === 'ios') {
            if (audioMimeType.includes('webm') || audioMimeType.includes('ogg')) {
              Alert.alert(
                'Format not supported',
                'This voice message was recorded in WebM format, which iPhone cannot play. Ask the sender to record on Safari, or listen on the web app.',
              );
            } else {
              Alert.alert('Playback error', 'Could not play this audio message.');
            }
          }
        } finally {
          setAudioLoading(false);
        }
      }
    },
    [audioMimeType, isAudioPlaying],
  );

  const handleFileOpen = useCallback(
    async (url: string, storagePath?: string) => {
      const key = storagePath ?? url;
      if (openingFile === key) return;
      setOpeningFile(key);
      try {
        let openUrl = url;
        if (storagePath) {
          const { data, error } = await supabase.storage
            .from(CHANNEL_FILES_BUCKET)
            .createSignedUrl(storagePath, 300);
          if (error || !data?.signedUrl) throw new Error();
          openUrl = data.signedUrl;
        }
        await WebBrowser.openBrowserAsync(openUrl, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        });
      } catch {
        // open falls back to system browser
        await Linking.openURL(url).catch(() => null);
      } finally {
        setOpeningFile(null);
      }
    },
    [openingFile],
  );

  const imageViewerItems = useMemo<ChatImageViewerItem[]>(() => {
    if (type !== 'image') return [];
    const im = message as ImageMessageVM;
    const attachments: ImageAttachmentVM[] = im.attachments?.length
      ? im.attachments
      : im.attachment
        ? [im.attachment]
        : [];
    return attachments.map((att, index) => ({
      key: att.storagePath ?? `${message.ids.id}-${index}`,
      originalUrl: att.url,
      previewUrl: att.storagePath ? imageSignedUrls[att.storagePath] : att.url,
      storagePath: att.storagePath,
      filename: att.name ?? null,
    }));
  }, [type, message, imageSignedUrls]);

  const openImageViewer = useCallback((index: number) => {
    setImageViewerIndex(index);
    setImageViewerVisible(true);
  }, []);

  const handleThreadPress = useCallback(async () => {
    if (!thread) {
      onThreadOpen?.(message);
      return;
    }
    const next = !threadExpanded;
    setThreadExpanded(next);
  }, [thread, threadExpanded, message, onThreadOpen]);

  const handleThreadReplyPress = useCallback(() => {
    onThreadOpen?.(message);
  }, [message, onThreadOpen]);

  // session-complete: full-width centred divider, no bubble
  if (type === 'session-complete') {
    return (
      <SessionCompleteBar
        message={message as SessionCompleteMessageVM}
        colors={colors}
        s={s}
      />
    );
  }

  // Layout is identical in channel and thread (own = right-aligned, "You", teal bubble).
  // isThreadMessage only controls: visibility badge, thread/reply button, inline expansion.
  const ownInChannel = isFeedTheme ? false : isOwn;

  // ── Image message (rendered edge-to-edge, no bubble padding) ─────────────

  const renderImageContent = () => {
    const im = message as ImageMessageVM;
    const attachments = im.attachments?.length ? im.attachments : [im.attachment];
    const isGallery = attachments.length > 1;
    const first = attachments[0]!;
    const singleAspect = first.width && first.height ? first.width / first.height : 4 / 3;

    // Use pre-generated signed URL for display; fall back to raw url if not yet ready
    const displayUrl = (att: ImageAttachmentVM) =>
      (att.storagePath ? imageSignedUrls[att.storagePath] : undefined) ?? att.url;

    return (
      <>
        {/* Caption text sits above the image card in its own sender-styled bubble */}
        {!!im.content?.text && (
          <View
            style={[s.bubble, ownInChannel ? s.bubbleOwn : s.bubbleOther, s.imageCaption]}
          >
            <FormattedText
              text={im.content.text}
              style={[s.textContent, ownInChannel && s.textContentOwn]}
              isOwn={ownInChannel}
            />
          </View>
        )}

        {isGallery ? (
          /* Gallery: 2-column grid with gap, each item gets its own border+radius */
          <View style={s.imageGalleryWrapper}>
            {attachments.map((att, i) => {
              return (
                <TouchableOpacity
                  key={`${att.url}-${i}`}
                  style={s.galleryItem}
                  activeOpacity={0.9}
                  onPress={() => openImageViewer(i)}
                >
                  <Image
                    source={{ uri: displayUrl(att) }}
                    style={s.galleryItemImg}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          /* Single image: rounded card with border, download btn overlay */
          <View style={[s.imageWrapper, { backgroundColor: colors.card }]}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => openImageViewer(0)}>
              <Image
                source={{ uri: displayUrl(first) }}
                style={[s.imagePreview, { aspectRatio: singleAspect }]}
                resizeMode="cover"
              />
            </TouchableOpacity>
          </View>
        )}
      </>
    );
  };

  // ── File message (rendered outside bubble for proper flex layout) ──────────

  const renderFileContent = () => {
    const fm = message as FileMessageVM;
    // attachments is now correctly populated by the mapper (mirrors web mapFileAttachments)
    const attachments = fm.attachments?.length ? fm.attachments : [fm.attachment];

    // File list visual: standalone card matching web "border border-border bg-muted/30 rounded-xl"
    // Rendered directly in contentCol (width:'85%' on fileListWrap gives definite px → flex:1 resolves).
    // Text (if any) goes in its own bubble above — same pattern as link preview.
    return (
      <>
        {!!fm.content?.text && (
          <View style={[s.fileCaptionBubble, ownInChannel ? s.bubbleOwn : s.bubbleOther]}>
            <FormattedText
              text={fm.content.text}
              style={[s.textContent, ownInChannel && s.textContentOwn]}
              isOwn={ownInChannel}
            />
          </View>
        )}
        <View
          style={[
            s.fileListWrap,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          {attachments.map((att, i) => {
            const fileKey = att.storagePath ?? att.url;
            const isOpening = openingFile === fileKey;
            return (
              <TouchableOpacity
                key={`${att.url}-${i}`}
                style={[
                  s.fileRowPadded,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                ]}
                onPress={() =>
                  isPdfAttachment(att)
                    ? setPdfViewerDocument({
                        url: att.url,
                        storagePath: att.storagePath,
                        filename: att.name,
                      })
                    : handleFileOpen(att.url, att.storagePath)
                }
                disabled={isOpening}
                accessibilityLabel={`Open ${att.name}`}
              >
                <View style={s.fileIcon}>
                  <FileText size={20} color={colors.teal} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{ fontSize: 14, fontWeight: '500', color: colors.text }}
                    numberOfLines={1}
                  >
                    {att.name}
                  </Text>
                  {!!att.size && (
                    <Text style={{ fontSize: 12, marginTop: 1, color: colors.textMuted }}>
                      {formatFileSize(att.size)}
                    </Text>
                  )}
                </View>
                {isOpening ? (
                  <ActivityIndicator size="small" color={colors.textMuted} />
                ) : (
                  <Download size={16} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </>
    );
  };

  // ── Audio message (rendered outside bubble, same pattern as file) ──────────

  const renderAudioContent = () => {
    const am = message as AudioRecordingMessageVM;
    const barCount = 28;
    const waveform =
      am.audio.waveform?.slice(0, barCount) ??
      Array.from({ length: barCount }, (_, i) => {
        const curve = Math.sin(((i + 2) / barCount) * Math.PI * 1.3);
        return Math.max(0.28, Math.min(0.92, 0.55 + curve * 0.28));
      });

    // Use real duration from expo-audio once loaded, fall back to message metadata
    const totalMs =
      audioDurationMs > 0 ? audioDurationMs : (am.audio.durationSeconds ?? 0) * 1000;
    const fmtMs = (ms: number) => {
      const s = Math.floor(ms / 1000);
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    };
    const progress = totalMs > 0 ? audioPositionMs / totalMs : 0;

    // Colors: audio player always uses neutral styling regardless of sender
    const playBtnBg = isAudioPlaying ? colors.teal : colors.tealBg;
    const playBtnBorder = colors.teal + '33';
    const playBtnColor = isAudioPlaying ? '#fff' : colors.teal;
    const barActive = colors.teal;
    const barInactive = colors.border;
    const timeColor = colors.textFaint;
    const cardBorder = colors.border;
    const cardBg = colors.card;

    // WebM/Opus (recorded by Chrome) cannot be decoded by iOS AVFoundation
    const isUnsupportedOnIOS =
      Platform.OS === 'ios' &&
      (am.audio.mimeType?.includes('webm') || am.audio.mimeType?.includes('ogg'));

    return (
      // width: '85%' (via fileBubble) ensures flex:1 waveform section resolves properly
      // Caption is rendered separately in renderAudioSection so it can use sender-bubble styling
      <View style={s.fileBubble}>
        {/* Inner card matches web: rounded-2xl border border-border bg-card px-3 py-3 */}
        <View style={[s.audioCard, { borderColor: cardBorder, backgroundColor: cardBg }]}>
          {isUnsupportedOnIOS && (
            <Text style={{ fontSize: 12, color: '#f59e0b', marginBottom: 6 }}>
              ⚠ This audio format is not supported on iPhone
            </Text>
          )}
          <View style={s.audioRow}>
            <TouchableOpacity
              style={[
                s.playBtn,
                {
                  backgroundColor: playBtnBg,
                  borderWidth: 1,
                  borderColor: playBtnBorder,
                },
              ]}
              onPress={() => handleAudioPress(audioSignedUrl ?? am.audio.url)}
              disabled={audioLoading}
              accessibilityLabel={isAudioPlaying ? 'Pause audio' : 'Play audio'}
            >
              {audioLoading ? (
                <ActivityIndicator size="small" color={playBtnColor} />
              ) : isAudioPlaying ? (
                <Pause size={15} color={playBtnColor} fill={playBtnColor} />
              ) : (
                <Play
                  size={15}
                  color={playBtnColor}
                  fill={playBtnColor}
                  style={{ marginLeft: 2 }}
                />
              )}
            </TouchableOpacity>
            <View style={{ flex: 1, gap: 4 }}>
              {/* Time row: currentTime left / duration right */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: timeColor }}>
                  {fmtMs(audioPositionMs)}
                </Text>
                <Text style={{ fontSize: 12, color: timeColor }}>{fmtMs(totalMs)}</Text>
              </View>
              {/* Waveform: bars before progress point are highlighted, rest are inactive */}
              <View style={s.waveformRow}>
                {waveform.map((v, i) => {
                  const played = i / barCount <= progress;
                  return (
                    <View
                      key={i}
                      style={{
                        flex: 1,
                        height: Math.max(8, Math.round(v * 16)),
                        backgroundColor: played ? barActive : barInactive,
                        borderRadius: 99,
                      }}
                    />
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // ── Audio section: caption bubble (own-styled) + audio player (always neutral) ──
  // Keeps text styling consistent with other sender messages while audio card stays green-free.

  const renderAudioSection = () => {
    const am = message as AudioRecordingMessageVM;
    const captionText = am.content?.text;
    return (
      <>
        {!!captionText && (
          <View style={[s.fileCaptionBubble, ownInChannel ? s.bubbleOwn : s.bubbleOther]}>
            <FormattedText
              text={captionText}
              style={[s.textContent, ownInChannel && s.textContentOwn]}
              isOwn={ownInChannel}
            />
          </View>
        )}
        {renderAudioContent()}
      </>
    );
  };

  // ── Link preview (rendered outside bubble — same flex:1 fix as file/audio) ──

  const renderLinkContent = () => {
    const lp = message as LinkPreviewMessageVM;

    // Fallback for legacy messages where link object wasn't populated
    if (!lp.link) {
      const fallback = lp.content?.text ?? '';
      if (!fallback) return null;
      return (
        <View style={[s.bubble, ownInChannel ? s.bubbleOwn : s.bubbleOther]}>
          <FormattedText
            text={fallback}
            mentions={lp.content?.mentions}
            style={[s.textContent, ownInChannel && s.textContentOwn]}
            isOwn={ownInChannel}
          />
        </View>
      );
    }

    // Text (if any) renders in its own regular bubble above the card.
    // The card is a direct child of contentCol with width:'85%' — no outer fileBubble wrapper —
    // so there's no color collision between outer and inner, matching the web layout where the
    // link card is a standalone bordered element (bg-card, border-border, rounded-xl).
    // Strip the URL itself from the caption — if the user sent only a URL there's nothing
    // left to show above the card (the card already displays the link).
    const caption = (lp.content?.text ?? '').replace(lp.link.url, '').trim();

    return (
      <>
        {!!caption && (
          <View style={[s.bubble, ownInChannel ? s.bubbleOwn : s.bubbleOther]}>
            <FormattedText
              text={caption}
              mentions={lp.content?.mentions}
              style={[s.textContent, ownInChannel && s.textContentOwn]}
              isOwn={ownInChannel}
            />
          </View>
        )}
        {/* Card width:'85%' on the card itself gives contentCol a definite px value → flex:1 inside resolves */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            s.linkCard,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
              width: '85%' as const,
            },
          ]}
          onPress={() => Linking.openURL(lp.link.url).catch(() => null)}
          accessibilityLabel={`Open link: ${lp.link.title}`}
        >
          {!!lp.link.imageUrl && (
            <View style={s.linkCardImgWrapper}>
              <Image
                source={{ uri: lp.link.imageUrl }}
                style={s.linkCardImg}
                resizeMode="cover"
                accessibilityLabel={lp.link.title}
              />
            </View>
          )}
          <View style={s.linkCardBody}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.linkCardTitle, { color: colors.text }]} numberOfLines={1}>
                  {lp.link.title}
                </Text>
                {!!lp.link.description && (
                  <Text
                    style={[s.linkCardDesc, { color: colors.textMuted }]}
                    numberOfLines={2}
                  >
                    {lp.link.description}
                  </Text>
                )}
                <View style={s.linkCardMeta}>
                  {!!lp.link.favicon && (
                    <Image source={{ uri: lp.link.favicon }} style={s.linkCardFavicon} />
                  )}
                  <Text
                    style={[s.linkCardSite, { color: colors.textFaint }]}
                    numberOfLines={1}
                  >
                    {lp.link.siteName || lp.link.url}
                  </Text>
                </View>
              </View>
              <ExternalLink
                size={16}
                color={colors.textMuted}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
            </View>
          </View>
        </TouchableOpacity>
      </>
    );
  };

  // ── Content inside bubble (or card) ──────────────────────────────────────

  const renderBubbleContent = () => {
    if (type === 'file' || type === 'audio-recording' || type === 'link-preview') {
      // handled by dedicated render functions — should not reach here
      return null;
    }

    // Default: formatted text (bold / italic / mentions)
    const text = (message as { content?: { text?: string } }).content?.text ?? '';
    const mentions = (message as { content?: { mentions?: MessageMentionVM[] } }).content
      ?.mentions;
    const emojiOnly = isEmojiOnlyText(text);
    return (
      <FormattedText
        text={text}
        mentions={mentions}
        style={[
          s.textContent,
          emojiOnly && s.emojiOnlyTextContent,
          ownInChannel && s.textContentOwn,
        ]}
        isOwn={ownInChannel}
      />
    );
  };

  // ── Card messages (lesson-assignment, session-summary, etc.) ──────────────
  // Cards manage their own visual styling; we just align them correctly.

  if (isCard) {
    return (
      <Pressable
        onLongPress={() => onLongPress?.(message)}
        delayLongPress={350}
        style={[s.row, ownInChannel && s.rowOwn, isGroupStart && s.rowGroupStart]}
      >
        <View style={s.avatarSlot}>
          {isGroupStart && (
            <Pressable onPress={() => onProfilePress?.(message.core.sender)} hitSlop={4}>
              <MessageAvatar
                name={senderDisplayName}
                src={avatarUrl}
                seed={avatarSeed}
                role={senderRole}
                themeKey={message.core.sender.ui?.themeKey}
              />
            </Pressable>
          )}
        </View>
        <View style={[s.contentCol, ownInChannel && s.contentColOwn]}>
          {isGroupStart && (
            <View style={[s.nameRow, ownInChannel && s.nameRowOwn]}>
              {ownInChannel ? (
                <>
                  <VisibilityBadge message={message} colors={colors} />
                  <Text style={s.msgTime}>{time}</Text>
                  <RoleNameIndicator
                    name="You"
                    role={senderRole}
                    textStyle={[s.senderName, { color: colors.textMuted }]}
                  />
                </>
              ) : (
                <Pressable
                  onPress={() => onProfilePress?.(message.core.sender)}
                  style={s.nameRow}
                >
                  <RoleNameIndicator
                    name={senderDisplayName}
                    role={senderRole}
                    textStyle={[s.senderName, { color: senderColor(senderDisplayName) }]}
                  />
                </Pressable>
              )}
              {!ownInChannel && !isThreadMessage && (
                <VisibilityBadge message={message} colors={colors} />
              )}
              {!ownInChannel && <Text style={s.msgTime}>{time}</Text>}
            </View>
          )}
          {type === 'lesson-assignment' && (
            <AssignmentCard
              message={message as LessonAssignmentMessageVM}
              colors={colors}
              s={s}
            />
          )}
          {type === 'session-summary' && (
            <SessionSummaryCard
              message={message as SessionSummaryMessageVM}
              colors={colors}
              s={s}
            />
          )}
          {type === 'progress-update' && (
            <ProgressCard
              message={message as ProgressUpdateMessageVM}
              colors={colors}
              s={s}
            />
          )}
          {type === 'event-reminder' && (
            <EventCard
              message={message as EventReminderMessageVM}
              colors={colors}
              s={s}
            />
          )}
          {type === 'homework-submission' && (
            <HomeworkCard
              message={message as HomeworkSubmissionMessageVM}
              colors={colors}
              s={s}
            />
          )}
          {type === 'feedback-request' && (
            <FeedbackRequestCard
              message={message as FeedbackRequestMessageVM}
              colors={colors}
              s={s}
            />
          )}
          {type === 'session-booking' && (
            <SessionBookingCard
              message={message as SessionBookingMessageVM}
              colors={colors}
              s={s}
            />
          )}
          {type === 'payment-reminder' && (
            <PaymentReminderCard
              message={message as PaymentReminderMessageVM}
              colors={colors}
              s={s}
            />
          )}
          {type === 'live-session-started' && (
            <LiveSessionStartedCard
              message={message as LiveSessionStartedMessageVM}
              colors={colors}
              s={s}
            />
          )}
          <SocialBar
            reactions={reactions}
            thread={thread}
            threadUnreadCount={threadUnreadCount}
            messageId={message.ids.id}
            colors={colors}
            onReactionToggle={isReadOnly ? undefined : onReactionToggle}
            onThreadPress={handleThreadPress}
            threadExpanded={threadExpanded}
            hideActions={hideActions}
            disabledActions={isReadOnly ?? false}
            hideThreadButton={isThreadMessage}
            showActionControls={showActionControls}
          />
          {!isThreadMessage && threadExpanded && (
            <View style={[s.inlineThread, isOwn && s.inlineThreadOwn]}>
              <View style={[s.threadLine, { backgroundColor: colors.border }]} />
              <View style={s.inlineReplies}>
                {threadLoading ? (
                  <View style={{ paddingVertical: 8, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={colors.teal} />
                  </View>
                ) : (
                  <>
                    {threadReplies.map((reply, replyIndex) => (
                      <React.Fragment key={reply.ids.id}>
                        {inlineUnreadStartIndex === replyIndex && (
                          <InlineUnreadDivider
                            count={threadUnreadCount}
                            colors={colors}
                          />
                        )}
                        <InlineReply
                          message={reply}
                          colors={colors}
                          currentProfileId={currentProfileId}
                        />
                      </React.Fragment>
                    ))}
                    <ThreadReplyButton
                      colors={colors}
                      onPress={handleThreadReplyPress}
                      disabled={isReadOnly ?? false}
                    />
                  </>
                )}
              </View>
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  // ── Bubble messages (text, file, audio, image) ────────────────────────────

  return (
    <>
      <Pressable
        onLongPress={() => onLongPress?.(message)}
        delayLongPress={350}
        style={[s.row, ownInChannel && s.rowOwn, isGroupStart && s.rowGroupStart]}
      >
        {/* Avatar slot */}
        <View style={s.avatarSlot}>
          {isGroupStart && (
            <Pressable onPress={() => onProfilePress?.(message.core.sender)} hitSlop={4}>
              <MessageAvatar
                name={senderDisplayName}
                src={avatarUrl}
                seed={avatarSeed}
                role={senderRole}
                themeKey={message.core.sender.ui?.themeKey}
              />
            </Pressable>
          )}
        </View>

        {/* Content column */}
        <View style={[s.contentCol, ownInChannel && s.contentColOwn]}>
          {/* Name + time above bubble */}
          {isGroupStart && (
            <View style={[s.nameRow, ownInChannel && s.nameRowOwn]}>
              {ownInChannel ? (
                <>
                  <VisibilityBadge message={message} colors={colors} />
                  <Text style={s.msgTime}>{time}</Text>
                  <RoleNameIndicator
                    name="You"
                    role={senderRole}
                    textStyle={[s.senderName, { color: colors.textMuted }]}
                  />
                </>
              ) : (
                <Pressable
                  onPress={() => onProfilePress?.(message.core.sender)}
                  style={s.nameRow}
                >
                  <RoleNameIndicator
                    name={senderDisplayName}
                    role={senderRole}
                    textStyle={[s.senderName, { color: senderColor(senderDisplayName) }]}
                  />
                </Pressable>
              )}
              {!ownInChannel && !isThreadMessage && (
                <VisibilityBadge message={message} colors={colors} />
              )}
              {!ownInChannel && <Text style={s.msgTime}>{time}</Text>}
            </View>
          )}
          {/* Dedicated layouts for rich message types; text/cards use bubble */}
          {type === 'image' ? (
            renderImageContent()
          ) : type === 'file' ? (
            renderFileContent()
          ) : type === 'audio-recording' ? (
            renderAudioSection()
          ) : type === 'link-preview' ? (
            renderLinkContent()
          ) : (
            <View
              testID="message-bubble"
              style={[s.bubble, ownInChannel ? s.bubbleOwn : s.bubbleOther]}
            >
              {renderBubbleContent()}
            </View>
          )}

          {/* Reactions + thread pill in one row */}
          <SocialBar
            reactions={reactions}
            thread={thread}
            threadUnreadCount={threadUnreadCount}
            messageId={message.ids.id}
            colors={colors}
            onReactionToggle={isReadOnly ? undefined : onReactionToggle}
            onThreadPress={handleThreadPress}
            threadExpanded={threadExpanded}
            hideActions={hideActions}
            disabledActions={isReadOnly ?? false}
            hideThreadButton={isThreadMessage}
            showActionControls={showActionControls}
          />

          {/* Inline thread replies (not shown when already inside a thread) */}
          {!isThreadMessage && threadExpanded && (
            <View style={[s.inlineThread, isOwn && s.inlineThreadOwn]}>
              <View style={[s.threadLine, { backgroundColor: colors.border }]} />
              <View style={s.inlineReplies}>
                {threadLoading ? (
                  <View style={{ paddingVertical: 8, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={colors.teal} />
                  </View>
                ) : (
                  <>
                    {threadReplies.map((reply, replyIndex) => (
                      <React.Fragment key={reply.ids.id}>
                        {inlineUnreadStartIndex === replyIndex && (
                          <InlineUnreadDivider
                            count={threadUnreadCount}
                            colors={colors}
                          />
                        )}
                        <InlineReply
                          message={reply}
                          colors={colors}
                          currentProfileId={currentProfileId}
                        />
                      </React.Fragment>
                    ))}
                    <ThreadReplyButton
                      colors={colors}
                      onPress={handleThreadReplyPress}
                      disabled={isReadOnly ?? false}
                    />
                  </>
                )}
              </View>
            </View>
          )}
        </View>
      </Pressable>
      {type === 'image' && (
        <ChatImageViewer
          visible={imageViewerVisible}
          items={imageViewerItems}
          initialIndex={imageViewerIndex}
          colors={colors}
          onClose={() => setImageViewerVisible(false)}
          onSend={onSendAnnotation}
        />
      )}
      {!!pdfViewerDocument && (
        <ChatPdfViewer
          visible={!!pdfViewerDocument}
          url={pdfViewerDocument.url}
          storagePath={pdfViewerDocument.storagePath}
          filename={pdfViewerDocument.filename}
          colors={colors}
          onClose={() => setPdfViewerDocument(null)}
          onSend={onSendAnnotation}
        />
      )}
    </>
  );
};
