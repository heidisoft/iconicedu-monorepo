import React, { useMemo } from 'react';
import { Avatar, StyledView, StyledText } from '@iconicedu/ui-native';

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
    <StyledView
      className={`flex-row gap-2 px-4 py-1 ${isOwn ? 'justify-end' : 'justify-start'}`}
    >
      {!isOwn && showSender && (
        <Avatar
          name={senderName}
          src={message.sender?.avatar_url}
          size="sm"
        />
      )}
      {!isOwn && !showSender && <StyledView className="w-8" />}

      <StyledView
        className={`max-w-[75%] rounded-2xl px-3 py-2 ${
          isOwn ? 'rounded-br-sm bg-brand-600' : 'rounded-bl-sm bg-slate-800'
        }`}
      >
        {!isOwn && showSender && (
          <StyledText className="mb-0.5 text-xs font-semibold text-brand-400">
            {senderName}
          </StyledText>
        )}

        {message.type === 'text' && text ? (
          <StyledText className="text-sm text-white">{text}</StyledText>
        ) : message.type === 'image' ? (
          <StyledText className="text-sm italic text-slate-300">
            [Image]
          </StyledText>
        ) : message.type === 'file' ? (
          <StyledText className="text-sm italic text-slate-300">
            [File]
          </StyledText>
        ) : (
          <StyledText className="text-sm italic text-slate-400">
            [{message.type}]
          </StyledText>
        )}

        <StyledText
          className={`mt-0.5 text-[10px] ${isOwn ? 'text-brand-200' : 'text-slate-500'}`}
        >
          {time}
        </StyledText>
      </StyledView>
    </StyledView>
  );
};
