import React, { useCallback, useRef } from 'react';
import { View, FlatList, ActivityIndicator } from 'react-native';
import type { MessageVM } from '@iconicedu/shared-types';
import { useTheme } from '@/providers/theme-provider';
import { MessageItem } from './message-item';

type MessageListProps = {
  messages: MessageVM[];
  currentProfileId: string;
  onLoadMore?: () => void;
  loading?: boolean;
};

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentProfileId,
  onLoadMore,
  loading = false,
}) => {
  const flatListRef = useRef<FlatList>(null);
  const { colors } = useTheme();

  const renderItem = useCallback(
    ({ item, index }: { item: MessageVM; index: number }) => {
      const isOwn = item.core.sender.ids.id === currentProfileId;
      const prev = index > 0 ? messages[index - 1] : null;
      const showSender =
        !isOwn &&
        (!prev || prev.core.sender.ids.id !== item.core.sender.ids.id);

      return (
        <MessageItem
          message={item}
          isOwn={isOwn}
          showSender={showSender}
          colors={colors}
        />
      );
    },
    [currentProfileId, messages, colors],
  );

  const keyExtractor = useCallback((item: MessageVM) => item.ids.id, []);

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      inverted
      contentContainerStyle={{ paddingVertical: 8 }}
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
