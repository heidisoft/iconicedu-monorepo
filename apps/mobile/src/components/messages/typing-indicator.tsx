import React from 'react';
import { StyledView, StyledText } from '@iconicedu/ui-native';

type TypingIndicatorProps = {
  typingUsers: string[];
};

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  typingUsers,
}) => {
  if (typingUsers.length === 0) return null;

  const text =
    typingUsers.length === 1
      ? `${typingUsers[0]} is typing...`
      : typingUsers.length === 2
        ? `${typingUsers[0]} and ${typingUsers[1]} are typing...`
        : `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`;

  return (
    <StyledView className="px-4 py-1">
      <StyledText className="text-xs italic text-slate-400">{text}</StyledText>
    </StyledView>
  );
};
