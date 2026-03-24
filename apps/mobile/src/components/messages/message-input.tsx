import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image as RNImage,
  ScrollView,
  Keyboard,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import type { AudioStatus } from 'expo-audio';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import type { MessageVM } from '@iconicedu/shared-types';
import { EmojiPicker } from './emoji-picker';
import { AttachmentSheet, type AttachmentPayload } from './attachment-sheet';
import { Smile, Plus, ArrowUp, X, FileText, Play, Pause } from 'lucide-react-native';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMessagePreviewText(message: MessageVM): string {
  const text = (message as { content?: { text?: string } }).content?.text;
  if (text) return text;
  const type = message.core?.type;
  if (type === 'image') return 'Image';
  if (type === 'audio-recording') return 'Voice message';
  if (type === 'file') return 'File';
  return 'Message';
}

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageInputProps = {
  onSend: (text: string) => void | Promise<void>;
  /** Called with picked/recorded attachments and optional caption — caller handles upload + send. */
  onSendAttachment?: (
    attachments: AttachmentPayload[],
    caption?: string,
  ) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  /** When true, an upload is in flight — shows spinner on the + button and blocks new uploads. */
  uploading?: boolean;
  onTypingChange?: () => void;
  /** Called when typing stops (input cleared or message sent). */
  onTypingStop?: () => void;
  /** When set, shows a reply-in-thread preview banner above the input bar. */
  replyTo?: MessageVM | null;
  /** Called when the user dismisses the reply preview with ✕. */
  onCancelReply?: () => void;
};

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors, bottomInset: number, keyboardVisible: boolean) {
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

    // Attachment preview strip (sits above the bar, same pattern as reply preview)
    attachPreview: {
      backgroundColor: C.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
      paddingVertical: 10,
    },
    attachPreviewContent: {
      paddingHorizontal: 12,
      gap: 8,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
    },
    // Image thumbnail
    attachThumbWrap: {
      width: 64,
      height: 64,
      borderRadius: 10,
      overflow: 'hidden',
    },
    attachThumb: {
      width: 64,
      height: 64,
    },
    attachRemoveBtn: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    attachThumbLoading: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: C.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
    },
    // File item
    attachFileItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      height: 64,
      maxWidth: 180,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    attachFileName: {
      flex: 1,
      fontSize: 12,
      color: C.text,
    },
    // Audio item
    attachAudioItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      height: 64,
      width: 160,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    attachAudioPlayBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: C.teal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attachAudioLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: C.text,
    },
    attachAudioMeta: {
      fontSize: 11,
      color: C.textMuted,
    },

    // Main input bar
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: keyboardVisible ? 8 : Math.max(bottomInset, 12),
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

    // Pill input row
    pill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 40,
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
      textAlignVertical: 'center',
    },

    // Smiley inside pill — right side
    emojiBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Send button — right of pill
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: C.teal,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  onSendAttachment,
  placeholder,
  disabled = false,
  uploading = false,
  onTypingChange,
  onTypingStop,
  replyTo,
  onCancelReply,
}) => {
  const [text, setText] = useState('');
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [inputHeight, setInputHeight] = useState(20);
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentPayload[]>([]);
  const [loadedImageUris, setLoadedImageUris] = useState<Set<string>>(new Set());
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const audioSoundRef = useRef<AudioPlayer | null>(null);
  const audioSubRef = useRef<{ remove(): void } | null>(null);
  const MAX_INPUT_HEIGHT = 120;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const s = React.useMemo(
    () => makeStyles(colors, insets.bottom, keyboardVisible),
    [colors, insets.bottom, keyboardVisible],
  );

  // Auto-focus the input whenever a reply target is set
  useEffect(() => {
    if (replyTo) {
      inputRef.current?.focus();
    }
  }, [replyTo]);

  // Reset image loading state whenever the pending set changes
  useEffect(() => {
    setLoadedImageUris(new Set());
  }, [pendingAttachments]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioSubRef.current?.remove();
      audioSoundRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const clearPendingAudio = useCallback(() => {
    audioSubRef.current?.remove();
    audioSubRef.current = null;
    audioSoundRef.current?.remove();
    audioSoundRef.current = null;
    setAudioPlaying(false);
  }, []);

  const handleToggleAudio = useCallback(
    (uri: string) => {
      if (!audioSoundRef.current) {
        const player = createAudioPlayer({ uri });
        audioSoundRef.current = player;
        setAudioPlaying(true);
        audioSubRef.current = player.addListener(
          'playbackStatusUpdate',
          (status: AudioStatus) => {
            setAudioPlaying(status.playing);
            if (status.didJustFinish) {
              player.seekTo(0).catch(() => null);
              setAudioPlaying(false);
            }
          },
        );
        player.play();
      } else if (audioPlaying) {
        audioSoundRef.current.pause();
      } else {
        audioSoundRef.current.play();
      }
    },
    [audioPlaying],
  );

  const handleRemovePending = useCallback(
    async (index: number) => {
      const removing = pendingAttachments[index];
      if (removing?.mimeType.startsWith('audio/')) {
        await clearPendingAudio();
      }
      setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
    },
    [pendingAttachments, clearPendingAudio],
  );

  const handleSend = useCallback(async () => {
    if (pendingAttachments.length > 0) {
      const attachments = pendingAttachments;
      const caption = text.trim() || undefined;
      setPendingAttachments([]);
      setText('');
      setInputHeight(20);
      onTypingStop?.();
      await clearPendingAudio();
      await onSendAttachment?.(attachments, caption);
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    setInputHeight(20);
    onTypingStop?.();
    await onSend(trimmed);
  }, [
    text,
    pendingAttachments,
    onSend,
    onSendAttachment,
    onTypingStop,
    clearPendingAudio,
  ]);

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

  const canSend = (text.trim().length > 0 || pendingAttachments.length > 0) && !disabled;

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
            <X size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Attachment preview strip — shown when the user has picked files/images/audio */}
      {pendingAttachments.length > 0 && (
        <View style={s.attachPreview}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.attachPreviewContent}
          >
            {pendingAttachments.map((a, i) => {
              if (a.mimeType.startsWith('image/')) {
                const loaded = loadedImageUris.has(a.uri);
                return (
                  <View key={i} style={s.attachThumbWrap}>
                    <RNImage
                      source={{ uri: a.uri }}
                      style={s.attachThumb}
                      resizeMode="cover"
                      onLoad={() =>
                        setLoadedImageUris((prev) => new Set([...prev, a.uri]))
                      }
                    />
                    {!loaded && (
                      <View style={s.attachThumbLoading}>
                        <ActivityIndicator size="small" color={colors.teal} />
                      </View>
                    )}
                    <TouchableOpacity
                      style={s.attachRemoveBtn}
                      onPress={() => handleRemovePending(i)}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    >
                      <X size={10} color="#fff" />
                    </TouchableOpacity>
                  </View>
                );
              }

              if (a.mimeType.startsWith('audio/')) {
                return (
                  <View key={i} style={s.attachAudioItem}>
                    <TouchableOpacity
                      style={s.attachAudioPlayBtn}
                      onPress={() => handleToggleAudio(a.uri)}
                      activeOpacity={0.8}
                    >
                      {audioPlaying ? (
                        <Pause size={14} color={colors.tealFg} />
                      ) : (
                        <Play size={14} color={colors.tealFg} />
                      )}
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={s.attachAudioLabel}>Voice</Text>
                      <Text style={s.attachAudioMeta}>
                        {a.durationSeconds ? fmtDuration(a.durationSeconds) : '—'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemovePending(i)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                );
              }

              // File
              return (
                <View key={i} style={s.attachFileItem}>
                  <FileText size={16} color={colors.teal} />
                  <Text style={s.attachFileName} numberOfLines={2}>
                    {a.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRemovePending(i)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={s.bar}>
        {/* + Attachment button — shows spinner while an upload is in flight */}
        <TouchableOpacity
          style={s.addBtn}
          disabled={disabled || uploading}
          activeOpacity={0.7}
          onPress={() => setAttachmentSheetVisible(true)}
          accessibilityLabel="Add attachment"
        >
          {uploading ? (
            <ActivityIndicator size="small" color={colors.teal} />
          ) : (
            <Plus size={22} color={colors.textMuted} />
          )}
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
            <Smile size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Send button — appears when text is present or attachments are pending */}
        {canSend && (
          <TouchableOpacity
            style={s.sendBtn}
            onPress={handleSend}
            activeOpacity={0.8}
            accessibilityLabel="Send message"
          >
            <ArrowUp size={20} color={colors.tealFg} />
          </TouchableOpacity>
        )}
      </View>

      <EmojiPicker
        visible={emojiPickerVisible}
        onClose={() => setEmojiPickerVisible(false)}
        onEmojiSelect={handleEmojiSelect}
      />

      <AttachmentSheet
        visible={attachmentSheetVisible}
        onClose={() => setAttachmentSheetVisible(false)}
        onAttach={(attachments) => {
          setPendingAttachments(attachments);
        }}
        disabled={disabled}
      />
    </>
  );
};
