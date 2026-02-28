import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import type { MessageVM } from '@iconicedu/shared-types';
import { EmojiPicker } from './emoji-picker';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMessagePreviewText(message: MessageVM): string {
  const text = (message as { content?: { text?: string } }).content?.text;
  if (text) return text;
  const type = message.core?.type;
  if (type === 'image') return '🖼 Image';
  if (type === 'audio-recording') return '🎵 Voice message';
  if (type === 'file') return '📎 File';
  return 'Message';
}

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageInputProps = {
  onSend: (text: string) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  onTypingChange?: () => void;
  /** Called when typing stops (input cleared or message sent). */
  onTypingStop?: () => void;
  /** When set, shows a reply-in-thread preview banner above the input bar. */
  replyTo?: MessageVM | null;
  /** Called when the user dismisses the reply preview with ✕. */
  onCancelReply?: () => void;
};

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors, bottomInset: number) {
  return StyleSheet.create({
    // Reply-in-thread preview banner (sits above the bar)
    replyPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: C.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
      gap: 10,
    },
    replyAccent: {
      width: 3,
      borderRadius: 2,
      alignSelf: 'stretch',
      minHeight: 28,
      backgroundColor: C.teal,
    },
    replyInfo: { flex: 1 },
    replySender: {
      fontSize: 12,
      fontWeight: '600',
      color: C.teal,
      marginBottom: 1,
    },
    replyText: {
      fontSize: 12,
      color: C.textMuted,
    },
    replyClose: {
      fontSize: 16,
      color: C.textMuted,
      paddingHorizontal: 4,
    },

    // Main input bar
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
      alignItems: 'center',
      backgroundColor: C.inputBg,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      paddingLeft: 14,
      paddingRight: 6,
      paddingVertical: 6,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: C.text,
      lineHeight: 20,
      paddingVertical: 0,
    },

    // Smiley inside pill — right side
    emojiBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emojiTxt: { fontSize: 18 },

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

// ─── Component ────────────────────────────────────────────────────────────────

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  placeholder,
  disabled = false,
  onTypingChange,
  onTypingStop,
  replyTo,
  onCancelReply,
}) => {
  const [text, setText] = useState('');
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [inputHeight, setInputHeight] = useState(20);
  const MAX_INPUT_HEIGHT = 120;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const s = React.useMemo(() => makeStyles(colors, insets.bottom), [colors, insets.bottom]);

  // Auto-focus the input whenever a reply target is set
  useEffect(() => {
    if (replyTo) {
      inputRef.current?.focus();
    }
  }, [replyTo]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    setInputHeight(20);
    onTypingStop?.();
    await onSend(trimmed);
  }, [text, onSend, onTypingStop]);

  const handleChangeText = useCallback(
    (t: string) => {
      setText(t);
      if (t.length > 0) {
        onTypingChange?.();
      } else {
        onTypingStop?.();
      }
    },
    [onTypingChange, onTypingStop],
  );

  const handleContentSizeChange = useCallback(
    (e: { nativeEvent: { contentSize: { height: number } } }) => {
      setInputHeight(e.nativeEvent.contentSize.height);
    },
    [],
  );

  const handleEmojiSelect = useCallback((emoji: string) => {
    setText((prev) => prev + emoji);
    inputRef.current?.focus();
  }, []);

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <>
      {/* Reply-in-thread preview banner */}
      {replyTo && (
        <View style={s.replyPreview}>
          <View style={s.replyAccent} />
          <View style={s.replyInfo}>
            <Text style={s.replySender} numberOfLines={1}>
              {replyTo.core.sender.profile.displayName}
            </Text>
            <Text style={s.replyText} numberOfLines={1}>
              {getMessagePreviewText(replyTo)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onCancelReply}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Cancel reply"
          >
            <Text style={s.replyClose}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

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
            style={[
              s.input,
              inputHeight > MAX_INPUT_HEIGHT ? { height: MAX_INPUT_HEIGHT } : undefined,
            ]}
            value={text}
            onChangeText={handleChangeText}
            onContentSizeChange={handleContentSizeChange}
            placeholder={placeholder ?? 'Type your message'}
            placeholderTextColor={colors.textFaint}
            multiline
            scrollEnabled={inputHeight > MAX_INPUT_HEIGHT}
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
