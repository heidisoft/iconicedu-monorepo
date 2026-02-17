import React, { useState, useCallback } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import {
  StyledView,
  StyledTextInput,
  IconButton,
  StyledText,
} from '@iconicedu/ui-native';

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
      <StyledView className="flex-row items-end gap-2 border-t border-slate-800 bg-slate-950 px-4 pb-8 pt-3">
        <StyledTextInput
          className="max-h-24 min-h-[40px] flex-1 rounded-2xl bg-slate-800 px-4 py-2.5 text-sm text-white"
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor="#64748b"
          multiline
          editable={!disabled}
          accessibilityLabel="Message input"
        />
        <IconButton
          icon={<StyledText className="text-lg text-white">{'➤'}</StyledText>}
          label="Send message"
          variant="default"
          size="md"
          onPress={handleSend}
          disabled={!text.trim() || disabled}
          className="bg-brand-600"
        />
      </StyledView>
    </KeyboardAvoidingView>
  );
};
