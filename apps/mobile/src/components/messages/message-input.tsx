import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import { EmojiPicker } from './emoji-picker';

type MessageInputProps = {
  onSend: (text: string) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  onTypingChange?: () => void;
};

function makeStyles(C: AppColors, bottomInset: number) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      paddingHorizontal: 12,
      paddingTop: 10,
      // Respect home-indicator inset; keyboard hides it so insets.bottom → 0 when open
      paddingBottom: Math.max(bottomInset, 12),
      backgroundColor: C.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
    },

    // "+" attachment button — left of pill
    addBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: C.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 0,
    },
    addTxt: {
      fontSize: 24,
      lineHeight: 28,
      color: C.textMuted,
      fontWeight: '300',
      includeFontPadding: false,
    },

    // Pill input row
    pill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: C.inputBg,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      paddingLeft: 16,
      paddingRight: 6,
      paddingVertical: 8,
      minHeight: 40,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: C.text,
      lineHeight: 20,
      maxHeight: 120,
      paddingVertical: 0,
    },

    // Smiley inside pill — right side
    emojiBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 4,
    },
    emojiTxt: { fontSize: 20 },

    // Send button — right of pill (only shown when text present)
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: C.teal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendTxt: {
      color: C.tealFg,
      fontSize: 20,
      fontWeight: '700',
      includeFontPadding: false,
    },
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
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const s = React.useMemo(() => makeStyles(colors, insets.bottom), [colors, insets.bottom]);

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
    inputRef.current?.focus();
  }, []);

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <>
      <View style={s.bar}>
        {/* + Attachment button */}
        <TouchableOpacity
          style={s.addBtn}
          disabled={disabled}
          activeOpacity={0.7}
          accessibilityLabel="Add attachment"
        >
          <Text style={s.addTxt}>+</Text>
        </TouchableOpacity>

        {/* Pill: text input + smiley */}
        <View style={s.pill}>
          <TextInput
            ref={inputRef}
            style={s.input}
            value={text}
            onChangeText={handleChangeText}
            placeholder={placeholder ?? 'Type your message'}
            placeholderTextColor={colors.textFaint}
            multiline
            editable={!disabled}
            accessibilityLabel="Message input"
          />
          <TouchableOpacity
            style={s.emojiBtn}
            disabled={disabled}
            activeOpacity={0.7}
            onPress={() => setEmojiPickerVisible(true)}
            accessibilityLabel="Open emoji picker"
          >
            <Text style={s.emojiTxt}>😊</Text>
          </TouchableOpacity>
        </View>

        {/* Send button — appears when text is present */}
        {canSend && (
          <TouchableOpacity
            style={s.sendBtn}
            onPress={handleSend}
            activeOpacity={0.8}
            accessibilityLabel="Send message"
          >
            <Text style={s.sendTxt}>↑</Text>
          </TouchableOpacity>
        )}
      </View>

      <EmojiPicker
        visible={emojiPickerVisible}
        onClose={() => setEmojiPickerVisible(false)}
        onEmojiSelect={handleEmojiSelect}
      />
    </>
  );
};
