import React, { useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import type { MessageVM } from '@iconicedu/shared-types';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import { MessageItem } from './message-item';

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
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: diffDays > 365 ? 'numeric' : undefined });
}

// ─── List item types ──────────────────────────────────────────────────────────

type DateSeparatorItem = { _type: 'date-separator'; dateKey: string; label: string };
type MessageListItem = MessageVM | DateSeparatorItem;

export function buildListData(messages: MessageVM[]): MessageListItem[] {
  // Messages arrive oldest-first; the FlatList is inverted so it renders
  // newest at the bottom. We insert date separators between groups.
  const items: MessageListItem[] = [];
  let lastDateKey = '';

  for (const msg of messages) {
    const key = getDateKey(msg.core.createdAt);
    if (key !== lastDateKey) {
      items.push({ _type: 'date-separator', dateKey: key, label: formatDateHeader(msg.core.createdAt) });
      lastDateKey = key;
    }
    items.push(msg);
  }

  return items;
}

function isDateSeparator(item: MessageListItem): item is DateSeparatorItem {
  return '_type' in item && item._type === 'date-separator';
}

// ─── Date Separator ───────────────────────────────────────────────────────────

function DateSeparator({ label, colors }: { label: string; colors: AppColors }) {
  return (
    <View style={sepStyles.row}>
      <View style={[sepStyles.line, { backgroundColor: colors.border }]} />
      <Text style={[sepStyles.label, { color: colors.textMuted, backgroundColor: colors.pageBg }]}>
        {label}
      </Text>
      <View style={[sepStyles.line, { backgroundColor: colors.border }]} />
    </View>
  );
}

const sepStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', marginVertical: 12, paddingHorizontal: 16, gap: 8 },
  line:  { flex: 1, height: 1 },
  label: { fontSize: 12, fontWeight: '600', paddingHorizontal: 8 },
});

// ─── Props ────────────────────────────────────────────────────────────────────

type MessageListProps = {
  messages: MessageVM[];
  currentProfileId: string;
  onLoadMore?: () => void;
  loading?: boolean;
  onMessageLongPress?: (message: MessageVM) => void;
  onReactionToggle?: (messageId: string, emoji: string) => void;
  onThreadOpen?: (message: MessageVM) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentProfileId,
  onLoadMore,
  loading = false,
  onMessageLongPress,
  onReactionToggle,
  onThreadOpen,
}) => {
  const flatListRef = useRef<FlatList>(null);
  const { colors } = useTheme();

  // Build items newest-first so inverted FlatList renders newest at the bottom
  const listData = useMemo(() => [...buildListData(messages)].reverse(), [messages]);

  const renderItem = useCallback(
    ({ item, index }: { item: MessageListItem; index: number }) => {
      if (isDateSeparator(item)) {
        return <DateSeparator label={item.label} colors={colors} />;
      }

      // For inverted FlatList, index 0 = newest. We need to find the prev message
      // (which is index-1, i.e. the next-newer message) to check sender continuity.
      // Walk forward in listData to find previous message item (skip separators).
      let prevMsg: MessageVM | null = null;
      for (let i = index + 1; i < listData.length; i++) {
        const candidate = listData[i];
        if (!isDateSeparator(candidate)) { prevMsg = candidate; break; }
      }

      const isOwn = item.core.sender.ids.id === currentProfileId;

      // A new group starts if: different sender, no prev message, or >5 min gap
      const timeDiffMinutes = prevMsg
        ? (new Date(item.core.createdAt).getTime() - new Date(prevMsg.core.createdAt).getTime()) / 60_000
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
        />
      );
    },
    [currentProfileId, listData, colors, onMessageLongPress, onReactionToggle, onThreadOpen],
  );

  const keyExtractor = useCallback((item: MessageListItem) => {
    if (isDateSeparator(item)) return `sep-${item.dateKey}`;
    return item.ids.id;
  }, []);

  return (
    <FlatList
      ref={flatListRef}
      data={listData}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      inverted
      contentContainerStyle={{ paddingVertical: 8, flexGrow: 1 }}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.3}
      ListFooterComponent={
        loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <ActivityIndicator size="small" color={colors.teal} />
          </View>
        ) : null
      }
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
    />
  );
};
