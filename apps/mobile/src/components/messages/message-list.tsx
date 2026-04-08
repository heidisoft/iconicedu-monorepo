import React, { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  View,
  Text,
  FlatList,
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
  unreadCount?: number;
  currentProfileId?: string;
}): string | null {
  const { messages, lastReadMessageId, unreadCount, currentProfileId } = input;
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

  if (normalizedUnreadCount <= 0) return null;
  const fallbackStartIndex = Math.max(0, messages.length - normalizedUnreadCount);
  return findIncomingId(fallbackStartIndex);
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

// ─── Props ────────────────────────────────────────────────────────────────────

type MessageListProps = {
  messages: MessageVM[];
  currentProfileId: string;
  currentAccountId?: string;
  onLoadMore?: () => void;
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
  unreadCount?: number;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const MessageList: React.FC<MessageListProps> = ({
  messages,
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
  unreadCount,
}) => {
  const flatListRef = useRef<FlatList>(null);
  const { colors } = useTheme();
  const isNearBottomRef = useRef(true);
  const lastNotifiedReadIdRef = useRef<string | null>(null);

  // Build items newest-first so inverted FlatList renders newest at the bottom
  const unreadAnchorMessageId = useMemo(
    () =>
      findUnreadStartMessageId({
        messages,
        lastReadMessageId,
        unreadCount,
        currentProfileId,
      }),
    [messages, lastReadMessageId, unreadCount, currentProfileId],
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
  const latestIncomingMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.core.sender.ids.id !== currentProfileId) {
        return message.ids.id;
      }
    }
    return null;
  }, [messages, currentProfileId]);

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
          isOwn={isOwn}
          isGroupStart={isGroupStart}
          colors={colors}
          onLongPress={onMessageLongPress}
          onReactionToggle={onReactionToggle}
          onThreadOpen={onThreadOpen}
          onProfilePress={onProfilePress}
          currentProfileId={currentProfileId}
          currentAccountId={currentAccountId}
          isReadOnly={isReadOnly}
        />
      );
    },
    [
      currentProfileId,
      currentAccountId,
      listData,
      colors,
      onMessageLongPress,
      onReactionToggle,
      onThreadOpen,
      onProfilePress,
      isReadOnly,
    ],
  );

  const keyExtractor = useCallback((item: MessageListItem) => {
    if (isDateSeparator(item)) return `sep-${item.dateKey}`;
    if (isUnreadSeparator(item)) return `unread-${item.count ?? 'marker'}`;
    return item.ids.id;
  }, []);

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
      contentContainerStyle={{ paddingVertical: 8, flexGrow: 1 }}
      onRefresh={onRefresh}
      refreshing={refreshing}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.3}
      onScroll={(event) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        isNearBottomRef.current = offsetY <= 40;
        maybeMarkUnreadAsViewed();
      }}
      scrollEventThrottle={120}
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
