import React from 'react';
import { View, Text } from 'react-native';

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
    <View className="px-4 py-1">
      <Text className="text-xs italic text-muted-foreground">{text}</Text>
    </View>
  );
};
