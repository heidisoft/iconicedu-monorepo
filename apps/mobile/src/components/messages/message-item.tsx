import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Avatar } from '@iconicedu/ui-native';

type MessageSender = {
  id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
};

export type MessageItemData = {
  id: string;
  type: string;
  content: { text?: string } | null;
  sender_profile_id: string;
  created_at: string;
  sender?: MessageSender | null;
};

type MessageItemProps = {
  message: MessageItemData;
  isOwn: boolean;
  showSender: boolean;
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getSenderName(sender?: MessageSender | null): string {
  if (!sender) return 'Unknown';
  if (sender.display_name) return sender.display_name;
  const parts = [sender.first_name, sender.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Unknown';
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isOwn,
  showSender,
}) => {
  const senderName = useMemo(
    () => getSenderName(message.sender),
    [message.sender],
  );
  const time = useMemo(() => formatTime(message.created_at), [message.created_at]);

  const text = message.content?.text ?? '';

  return (
    <View
      className={`flex-row gap-2 px-4 py-1 ${isOwn ? 'justify-end' : 'justify-start'}`}
    >
      {!isOwn && showSender && (
        <Avatar
          name={senderName}
          src={message.sender?.avatar_url}
          size="sm"
        />
      )}
      {!isOwn && !showSender && <View className="w-8" />}

      <View
        className={`max-w-[75%] rounded-2xl px-3 py-2 ${
          isOwn ? 'rounded-br-sm bg-primary' : 'rounded-bl-sm bg-secondary'
        }`}
      >
        {!isOwn && showSender && (
          <Text className="mb-0.5 text-xs font-semibold text-primary">
            {senderName}
          </Text>
        )}

        {message.type === 'text' && text ? (
          <Text className={`text-sm ${isOwn ? 'text-primary-foreground' : 'text-foreground'}`}>{text}</Text>
        ) : message.type === 'image' ? (
          <Text className="text-sm italic text-muted-foreground">
            [Image]
          </Text>
        ) : message.type === 'file' ? (
          <Text className="text-sm italic text-muted-foreground">
            [File]
          </Text>
        ) : (
          <Text className="text-sm italic text-muted-foreground">
            [{message.type}]
          </Text>
        )}

        <Text
          className={`mt-0.5 text-[10px] ${isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}
        >
          {time}
        </Text>
      </View>
    </View>
  );
};
