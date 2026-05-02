import React, { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  View,
  Text,
  FlatList,
  Animated,
  ActivityIndicator,
  StyleSheet,
  AppState,
} from 'react-native';
import { GraduationCap, LifeBuoy, MessageSquare } from 'lucide-react-native';
import type { MessageVM } from '@iconicedu/shared-types';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import { MessageItem } from './message-item';
import { PendingMessageRow, type PendingUpload } from './pending-message-row';

// ─── Date grouping helpers ────────────────────────────────────────────────────

function getDateKey(iso: string): string {
  return new Date(iso).toDateString(); // e.g. "Sun Dec 22 2025"
}

function formatDateHeader(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], {
    month: 'long',
    day: 'numeric',
    year: diffDays > 365 ? 'numeric' : undefined,
  });
}

// ─── List item types ──────────────────────────────────────────────────────────

type DateSeparatorItem = { _type: 'date-separator'; dateKey: string; label: string };
type UnreadSeparatorItem = { _type: 'unread-separator'; count?: number };
type MessageListItem = MessageVM | DateSeparatorItem | UnreadSeparatorItem;

function findUnreadStartMessageId(input: {
  messages: MessageVM[];
  lastReadMessageId?: string | null;
  lastReadAt?: string | null;
  unreadCount?: number;
  currentProfileId?: string;
}): string | null {
  const { messages, lastReadMessageId, lastReadAt, unreadCount, currentProfileId } =
    input;
  const normalizedUnreadCount = Math.max(0, unreadCount ?? 0);
  if (messages.length === 0) return null;

  const findIncomingId = (startIndex: number): string | null => {
    for (let index = startIndex; index < messages.length; index += 1) {
      const message = messages[index];
      if (!currentProfileId || message.core.sender.ids.id !== currentProfileId) {
        return message.ids.id;
      }
    }
    return null;
  };

  if (lastReadMessageId) {
    const lastReadIndex = messages.findIndex(
      (message) => message.ids.id === lastReadMessageId,
    );
    if (lastReadIndex >= 0) {
      return findIncomingId(lastReadIndex + 1);
    }
  }

  if (lastReadAt) {
    const lastReadAtTime = new Date(lastReadAt).getTime();
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const createdAtTime = new Date(messages[index].core.createdAt).getTime();
      if (createdAtTime <= lastReadAtTime) {
        return findIncomingId(index + 1);
      }
    }
    return findIncomingId(0);
  }

  if (normalizedUnreadCount <= 0) return null;
  const fallbackStartIndex = Math.max(0, messages.length - normalizedUnreadCount);
  return findIncomingId(fallbackStartIndex);
}

export function findLatestUnreadIncomingMessageId(input: {
  messages: MessageVM[];
  lastReadMessageId?: string | null;
  lastReadAt?: string | null;
  unreadCount?: number;
  currentProfileId?: string;
}): string | null {
  const unreadStartMessageId = findUnreadStartMessageId(input);
  if (!unreadStartMessageId) {
    return null;
  }

  const unreadStartIndex = input.messages.findIndex(
    (message) => message.ids.id === unreadStartMessageId,
  );
  if (unreadStartIndex < 0) {
    return null;
  }

  for (let index = input.messages.length - 1; index >= unreadStartIndex; index -= 1) {
    const message = input.messages[index];
    if (
      !input.currentProfileId ||
      message.core.sender.ids.id !== input.currentProfileId
    ) {
      return message.ids.id;
    }
  }

  return null;
}

export function buildListData(
  messages: MessageVM[],
  options?: {
    unreadAnchorMessageId?: string | null;
    unreadCount?: number;
  },
): MessageListItem[] {
  // Messages arrive oldest-first; the FlatList is inverted so it renders
  // newest at the bottom. We insert date separators between groups.
  const items: MessageListItem[] = [];
  let lastDateKey = '';
  const unreadAnchorMessageId = options?.unreadAnchorMessageId ?? null;

  for (const msg of messages) {
    const key = getDateKey(msg.core.createdAt);
    if (key !== lastDateKey) {
      items.push({
        _type: 'date-separator',
        dateKey: key,
        label: formatDateHeader(msg.core.createdAt),
      });
      lastDateKey = key;
    }
    if (unreadAnchorMessageId && msg.ids.id === unreadAnchorMessageId) {
      items.push({
        _type: 'unread-separator',
        count: options?.unreadCount,
      });
    }
    items.push(msg);
  }

  return items;
}

function isDateSeparator(item: MessageListItem): item is DateSeparatorItem {
  return '_type' in item && item._type === 'date-separator';
}

function isUnreadSeparator(item: MessageListItem): item is UnreadSeparatorItem {
  return '_type' in item && item._type === 'unread-separator';
}

// ─── Date Separator ───────────────────────────────────────────────────────────

function DateSeparator({ label, colors }: { label: string; colors: AppColors }) {
  return (
    <View style={sepStyles.row}>
      <View style={[sepStyles.line, { backgroundColor: colors.border }]} />
      <Text
        style={[
          sepStyles.label,
          { color: colors.textMuted, backgroundColor: colors.pageBg },
        ]}
      >
        {label}
      </Text>
      <View style={[sepStyles.line, { backgroundColor: colors.border }]} />
    </View>
  );
}

const sepStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  line: { flex: 1, height: 1 },
  label: { fontSize: 12, fontWeight: '600', paddingHorizontal: 8 },
});

function UnreadSeparator({ count, colors }: { count?: number; colors: AppColors }) {
  const label = count && count > 0 ? `New messages (${count})` : 'New messages';
  return (
    <View style={unreadStyles.row}>
      <View style={[unreadStyles.line, { backgroundColor: colors.border }]} />
      <View
        style={[
          unreadStyles.badge,
          {
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
          },
        ]}
      >
        <Text style={[unreadStyles.label, { color: colors.textMuted }]}>{label}</Text>
      </View>
      <View style={[unreadStyles.line, { backgroundColor: colors.border }]} />
    </View>
  );
}

const unreadStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  line: { flex: 1, height: 1 },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

// ─── Skeleton loader ──────────────────────────────────────────────────────────

// Matches the visual structure of MessageItem rows so the loading state
// occupies the same space as real messages.
const SKELETON_ROWS: ReadonlyArray<{
  isOwn: boolean;
  isGroupStart: boolean;
  bubbleWidth: string; // % of content column
  lines: number;
  nameWidth?: number; // px — only for group-start other rows
}> = [
  // Group 1 — other (3 messages)
  { isOwn: false, isGroupStart: true, bubbleWidth: '72%', lines: 1, nameWidth: 88 },
  { isOwn: false, isGroupStart: false, bubbleWidth: '55%', lines: 1 },
  { isOwn: false, isGroupStart: false, bubbleWidth: '78%', lines: 2 },
  // Group 2 — own (2 messages)
  { isOwn: true, isGroupStart: true, bubbleWidth: '42%', lines: 1 },
  { isOwn: true, isGroupStart: false, bubbleWidth: '60%', lines: 1 },
  // Group 3 — other (3 messages)
  { isOwn: false, isGroupStart: true, bubbleWidth: '65%', lines: 1, nameWidth: 76 },
  { isOwn: false, isGroupStart: false, bubbleWidth: '48%', lines: 1 },
  { isOwn: false, isGroupStart: false, bubbleWidth: '50%', lines: 1 },
  // Group 4 — own (1 message)
  { isOwn: true, isGroupStart: true, bubbleWidth: '36%', lines: 1 },
];

// Single-line bubble height = paddingVertical × 2 + lineHeight = 10 + 10 + 22 = 42
const BUBBLE_LINE_HEIGHT = 22;
const BUBBLE_PADDING_VERTICAL = 10;

function MessageListSkeleton({ colors }: { colors: AppColors }) {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  const bg = colors.border;

  return (
    <View style={skelStyles.container}>
      {SKELETON_ROWS.map((row, i) => {
        const bubbleHeight = BUBBLE_PADDING_VERTICAL * 2 + BUBBLE_LINE_HEIGHT * row.lines;
        return (
          <View
            key={i}
            style={[
              skelStyles.row,
              row.isOwn && skelStyles.rowOwn,
              row.isGroupStart && skelStyles.rowGroupStart,
            ]}
          >
            {/* Avatar slot — always 36px wide to match MessageItem layout */}
            <View style={skelStyles.avatarSlot}>
              {row.isGroupStart && !row.isOwn && (
                <Animated.View
                  style={[skelStyles.avatar, { backgroundColor: bg, opacity }]}
                />
              )}
            </View>

            {/* Content column */}
            <View style={[skelStyles.contentCol, row.isOwn && skelStyles.contentColOwn]}>
              {/* Name bar — group-start incoming messages only */}
              {row.isGroupStart && !row.isOwn && (
                <Animated.View
                  style={[
                    skelStyles.nameBar,
                    { backgroundColor: bg, opacity, width: row.nameWidth ?? 88 },
                  ]}
                />
              )}

              {/* Bubble placeholder */}
              <Animated.View
                style={[
                  skelStyles.bubble,
                  {
                    backgroundColor: bg,
                    opacity,
                    width: row.bubbleWidth as `${number}%`,
                    height: bubbleHeight,
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const skelStyles = StyleSheet.create({
  // Flush to the bottom of the container — messages stack upward like the real list
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingVertical: 8,
  },
  // Mirror MessageItem row styles exactly
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 3,
    gap: 8,
  },
  rowOwn: { flexDirection: 'row-reverse' },
  rowGroupStart: { paddingTop: 12 },
  // Avatar slot: same 36px reserved width as in MessageItem
  avatarSlot: { width: 36, flexShrink: 0, alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  // Content column mirrors MessageItem contentCol / contentColOwn
  contentCol: { flex: 1, alignItems: 'flex-start', gap: 2 },
  contentColOwn: { alignItems: 'flex-end' },
  // Name bar: height matches senderName fontSize (14)
  nameBar: { height: 14, borderRadius: 7, marginBottom: 0 },
  // Bubble: borderRadius matches MessageItem bubble (18)
  bubble: { borderRadius: 18 },
});

// ─── Props ────────────────────────────────────────────────────────────────────

export type MessageListProps = {
  messages: MessageVM[];
  channelId?: string;
  currentProfileId: string;
  currentAccountId?: string;
  onLoadMore?: () => boolean | void | Promise<boolean | void>;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onMessageLongPress?: (message: MessageVM) => void;
  onReactionToggle?: (messageId: string, emoji: string) => void;
  onThreadOpen?: (message: MessageVM) => void;
  onProfilePress?: (user: MessageVM['core']['sender']) => void;
  /** Optimistic pending uploads — appear at the bottom while upload is in flight. */
  pendingUploads?: PendingUpload[];
  /** Called when the user taps "retry" on a failed upload row. */
  onRetryUpload?: (pendingId: string) => void;
  isReadOnly?: boolean;
  onUnreadViewed?: (lastReadMessageId: string) => void;
  isScreenActive?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: 'message-square' | 'life-buoy' | 'graduation-cap';
  lastReadMessageId?: string | null;
  lastReadAt?: string | null;
  unreadCount?: number;
  onSendAnnotation?: (attachment: import('./attachment-sheet').AttachmentPayload) => void;
  messageUiThemeKey?: 'classic' | 'feed';
};

// ─── Component ────────────────────────────────────────────────────────────────

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  channelId,
  currentProfileId,
  currentAccountId,
  onLoadMore,
  loading = false,
  refreshing = false,
  onRefresh,
  onMessageLongPress,
  onReactionToggle,
  onThreadOpen,
  onProfilePress,
  pendingUploads,
  onRetryUpload,
  isReadOnly,
  onUnreadViewed,
  isScreenActive = true,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  lastReadMessageId,
  lastReadAt,
  unreadCount,
  onSendAnnotation,
  messageUiThemeKey = 'classic',
}) => {
  const flatListRef = useRef<FlatList>(null);
  const { colors } = useTheme();
  const isNearBottomRef = useRef(true);
  const lastNotifiedReadIdRef = useRef<string | null>(null);
  const scrollOffsetRef = useRef(0);
  const contentHeightRef = useRef(0);
  const reactionStartContentHeightRef = useRef(0);
  const preserveOffsetAfterReactionRef = useRef(false);

  // Build items newest-first so inverted FlatList renders newest at the bottom
  const unreadAnchorMessageId = useMemo(
    () =>
      findUnreadStartMessageId({
        messages,
        lastReadMessageId,
        lastReadAt,
        unreadCount,
        currentProfileId,
      }),
    [messages, lastReadMessageId, lastReadAt, unreadCount, currentProfileId],
  );
  const listData = useMemo(
    () =>
      [
        ...buildListData(messages, {
          unreadAnchorMessageId,
          unreadCount,
        }),
      ].reverse(),
    [messages, unreadAnchorMessageId, unreadCount],
  );
  const latestIncomingMessageId = useMemo(
    () =>
      findLatestUnreadIncomingMessageId({
        messages,
        lastReadMessageId,
        lastReadAt,
        unreadCount,
        currentProfileId,
      }),
    [messages, lastReadMessageId, lastReadAt, unreadCount, currentProfileId],
  );

  const maybeMarkUnreadAsViewed = useCallback(() => {
    if (!onUnreadViewed || !latestIncomingMessageId || !isScreenActive || isReadOnly) {
      return;
    }
    if (!isNearBottomRef.current) {
      return;
    }
    if (AppState.currentState !== 'active') {
      return;
    }
    if (lastNotifiedReadIdRef.current === latestIncomingMessageId) {
      return;
    }
    lastNotifiedReadIdRef.current = latestIncomingMessageId;
    onUnreadViewed(latestIncomingMessageId);
  }, [isReadOnly, isScreenActive, latestIncomingMessageId, onUnreadViewed]);

  // Scroll to the newest message (offset 0 in an inverted list = visual bottom)
  // when a new message is appended. Loading older messages prepends to the front
  // and leaves messages[last].id unchanged, so those don't trigger a scroll.
  const lastMessageIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const newLastId = messages[messages.length - 1]?.ids.id;
    if (newLastId && newLastId !== lastMessageIdRef.current) {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      });
    }
    lastMessageIdRef.current = newLastId;
    maybeMarkUnreadAsViewed();
  }, [messages, maybeMarkUnreadAsViewed]);

  useEffect(() => {
    maybeMarkUnreadAsViewed();
  }, [maybeMarkUnreadAsViewed]);

  const handleReactionToggle = useCallback(
    (messageId: string, emoji: string) => {
      preserveOffsetAfterReactionRef.current = true;
      reactionStartContentHeightRef.current = contentHeightRef.current;
      onReactionToggle?.(messageId, emoji);
    },
    [onReactionToggle],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: MessageListItem; index: number }) => {
      if (isDateSeparator(item)) {
        return <DateSeparator label={item.label} colors={colors} />;
      }
      if (isUnreadSeparator(item)) {
        return <UnreadSeparator count={item.count} colors={colors} />;
      }

      // For inverted FlatList, index 0 = newest. We need to find the prev message
      // (which is index-1, i.e. the next-newer message) to check sender continuity.
      // Walk forward in listData to find previous message item (skip separators).
      let prevMsg: MessageVM | null = null;
      for (let i = index + 1; i < listData.length; i++) {
        const candidate = listData[i];
        if (!isDateSeparator(candidate) && !isUnreadSeparator(candidate)) {
          prevMsg = candidate;
          break;
        }
      }

      const isOwn = item.core.sender.ids.id === currentProfileId;

      // A new group starts if: different sender, no prev message, or >5 min gap
      const timeDiffMinutes = prevMsg
        ? (new Date(item.core.createdAt).getTime() -
            new Date(prevMsg.core.createdAt).getTime()) /
          60_000
        : Infinity;
      const isGroupStart =
        !prevMsg ||
        prevMsg.core.sender.ids.id !== item.core.sender.ids.id ||
        timeDiffMinutes > 5;

      return (
        <MessageItem
          message={item}
          channelId={channelId}
          isOwn={isOwn}
          isGroupStart={isGroupStart}
          colors={colors}
          onLongPress={onMessageLongPress}
          onReactionToggle={handleReactionToggle}
          onThreadOpen={onThreadOpen}
          onProfilePress={onProfilePress}
          currentProfileId={currentProfileId}
          currentAccountId={currentAccountId}
          isReadOnly={isReadOnly}
          onSendAnnotation={onSendAnnotation}
          messageUiThemeKey={messageUiThemeKey}
        />
      );
    },
    [
      currentProfileId,
      currentAccountId,
      channelId,
      listData,
      colors,
      onMessageLongPress,
      handleReactionToggle,
      onThreadOpen,
      onProfilePress,
      isReadOnly,
      onSendAnnotation,
      messageUiThemeKey,
    ],
  );

  const keyExtractor = useCallback((item: MessageListItem) => {
    if (isDateSeparator(item)) return `sep-${item.dateKey}`;
    if (isUnreadSeparator(item)) return `unread-${item.count ?? 'marker'}`;
    return item.ids.id;
  }, []);

  // Show skeleton on initial load (no messages yet), empty state otherwise
  const isInitialLoading = loading && listData.length === 0;

  const isEmpty =
    !loading && listData.length === 0 && !(pendingUploads && pendingUploads.length);

  const emptyIconNode: ReactNode =
    emptyIcon === 'life-buoy' ? (
      <LifeBuoy size={28} color={colors.teal} />
    ) : emptyIcon === 'graduation-cap' ? (
      <GraduationCap size={28} color={colors.teal} />
    ) : (
      <MessageSquare size={28} color={colors.teal} />
    );

  if (isInitialLoading) {
    return <MessageListSkeleton colors={colors} />;
  }

  if (isEmpty) {
    return (
      <View style={emptyStyles.wrap}>
        <View style={[emptyStyles.iconWrap, { backgroundColor: colors.inputBg }]}>
          {emptyIconNode}
        </View>
        <Text style={[emptyStyles.title, { color: colors.text }]}>
          {emptyTitle ?? 'Start the conversation'}
        </Text>
        <Text style={[emptyStyles.description, { color: colors.textMuted }]}>
          {emptyDescription ??
            'Share a welcome message, lesson update, or question to begin the discussion.'}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={flatListRef}
      data={listData}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      inverted
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingVertical: 8, flexGrow: 1 }}
      onRefresh={onRefresh}
      refreshing={refreshing}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.3}
      onScroll={(event) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        scrollOffsetRef.current = offsetY;
        isNearBottomRef.current = offsetY <= 40;
        maybeMarkUnreadAsViewed();
      }}
      scrollEventThrottle={120}
      onContentSizeChange={(_, contentHeight) => {
        if (preserveOffsetAfterReactionRef.current) {
          preserveOffsetAfterReactionRef.current = false;
          const offset = scrollOffsetRef.current;
          const previousContentHeight = reactionStartContentHeightRef.current;
          contentHeightRef.current = contentHeight;
          requestAnimationFrame(() => {
            flatListRef.current?.scrollToOffset({
              offset: Math.max(0, offset),
              animated: false,
            });
          });
          if (isNearBottomRef.current && contentHeight > previousContentHeight) {
            requestAnimationFrame(() => {
              flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
            });
          }
          return;
        }

        const previousContentHeight = contentHeightRef.current;
        contentHeightRef.current = contentHeight;
        if (isNearBottomRef.current && contentHeight > previousContentHeight) {
          requestAnimationFrame(() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
          });
        }
      }}
      // In an inverted FlatList, ListHeaderComponent renders at the VISUAL BOTTOM —
      // perfect for pending uploads that appear just above the input bar.
      ListHeaderComponent={
        pendingUploads && pendingUploads.length > 0 ? (
          <View>
            {pendingUploads.map((p) => (
              <PendingMessageRow
                key={p.id}
                pending={p}
                colors={colors}
                onRetry={() => onRetryUpload?.(p.id)}
              />
            ))}
          </View>
        ) : null
      }
      ListFooterComponent={
        loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <ActivityIndicator size="small" color={colors.teal} />
          </View>
        ) : null
      }
    />
  );
};

const emptyStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
