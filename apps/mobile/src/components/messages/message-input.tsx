import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import { EmojiPicker } from './emoji-picker';

type MessageInputProps = {
  onSend: (text: string) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  onTypingChange?: () => void;
};

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    avoid: {},
    row: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: Platform.OS === 'ios' ? 24 : 12,
      borderTopWidth: 1,
      borderTopColor: C.border,
      backgroundColor: C.bg,
    },

    // Emoji / attachment button (left)
    sideBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: C.inputBg,
      borderWidth: 1, borderColor: C.border,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 2,
    },
    sideTxt: { fontSize: 18, lineHeight: 22 },

    // Pill input
    inputWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: C.inputBg,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 14,
      paddingVertical: 0,
      minHeight: 40,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: C.text,
      paddingTop: Platform.OS === 'ios' ? 10 : 8,
      paddingBottom: Platform.OS === 'ios' ? 10 : 8,
      maxHeight: 100,
    },

    // Send / Mic button (right)
    actionBtn: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 2,
    },
    sendBtn:  { backgroundColor: C.teal },
    micBtn:   { backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border },
    sendTxt:  { color: C.tealFg, fontSize: 15, fontWeight: '700' },
    micTxt:   { fontSize: 16, color: C.textMuted },
  });
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  placeholder,
  disabled = false,
  onTypingChange,
}) => {
  const [text, setText] = useState('');
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const { colors } = useTheme();
  const s = React.useMemo(() => makeStyles(colors), [colors]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    await onSend(trimmed);
  }, [text, onSend]);

  const handleChangeText = useCallback(
    (t: string) => {
      setText(t);
      if (t.length > 0) onTypingChange?.();
    },
    [onTypingChange],
  );

  const handleEmojiSelect = useCallback((emoji: string) => {
    setText((prev) => prev + emoji);
  }, []);

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
        style={s.avoid}
      >
        <View style={s.row}>
          {/* Emoji picker button */}
          <TouchableOpacity
            style={s.sideBtn}
            disabled={disabled}
            onPress={() => setEmojiPickerVisible(true)}
            accessibilityLabel="Open emoji picker"
          >
            <Text style={s.sideTxt}>😊</Text>
          </TouchableOpacity>

          {/* Pill text input */}
          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              value={text}
              onChangeText={handleChangeText}
              placeholder={placeholder ?? 'Message…'}
              placeholderTextColor={colors.textFaint}
              multiline
              editable={!disabled}
              accessibilityLabel="Message input"
            />
          </View>

          {/* Send when text present, mic otherwise */}
          {canSend ? (
            <TouchableOpacity
              style={[s.actionBtn, s.sendBtn]}
              onPress={handleSend}
              accessibilityLabel="Send message"
            >
              <Text style={s.sendTxt}>↑</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.actionBtn, s.micBtn]}
              accessibilityLabel="Voice message"
            >
              <Text style={s.micTxt}>🎙</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Emoji picker modal */}
      <EmojiPicker
        visible={emojiPickerVisible}
        onClose={() => setEmojiPickerVisible(false)}
        onEmojiSelect={handleEmojiSelect}
      />
    </>
  );
};
