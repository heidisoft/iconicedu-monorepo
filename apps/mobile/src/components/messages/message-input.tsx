import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { IconButton } from '@iconicedu/ui-native';

type MessageInputProps = {
  onSend: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  placeholder = 'Type a message...',
  disabled = false,
}) => {
  const [text, setText] = useState('');

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  }, [text, onSend]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View className="flex-row items-end gap-2 border-t border-border bg-background px-4 pb-8 pt-3">
        <TextInput
          className="max-h-24 min-h-[40px] flex-1 rounded-2xl bg-secondary px-4 py-2.5 text-sm text-foreground"
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor="#a1a1aa"
          multiline
          editable={!disabled}
          accessibilityLabel="Message input"
        />
        <IconButton
          icon={<Text className="text-lg text-primary-foreground">{'➤'}</Text>}
          label="Send message"
          variant="default"
          size="default"
          onPress={handleSend}
          disabled={!text.trim() || disabled}
          className="bg-primary"
        />
      </View>
    </KeyboardAvoidingView>
  );
};
