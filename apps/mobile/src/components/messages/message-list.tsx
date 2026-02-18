import React, { useCallback, useRef } from 'react';
import { View, FlatList, ActivityIndicator } from 'react-native';
import { NAV_THEME } from '@iconicedu/ui-native';
import { MessageItem, type MessageItemData } from './message-item';

type MessageListProps = {
  messages: MessageItemData[];
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

  const renderItem = useCallback(
    ({ item, index }: { item: MessageItemData; index: number }) => {
      const isOwn = item.sender_profile_id === currentProfileId;
      const prevMessage = index > 0 ? messages[index - 1] : null;
      const showSender =
        !isOwn &&
        (!prevMessage ||
          prevMessage.sender_profile_id !== item.sender_profile_id);

      return (
        <MessageItem message={item} isOwn={isOwn} showSender={showSender} />
      );
    },
    [currentProfileId, messages],
  );

  const keyExtractor = useCallback(
    (item: MessageItemData) => item.id,
    [],
  );

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
          <View className="items-center py-4">
            <ActivityIndicator size="small" color={NAV_THEME.dark.primary} />
          </View>
        ) : null
      }
      maintainVisibleContentPosition={{
        minIndexForVisible: 0,
      }}
    />
  );
};
