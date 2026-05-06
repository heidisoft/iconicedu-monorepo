import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Animated,
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
import { RoleNameIndicator } from '@/components/profile/role-name-indicator';
import type { AppColors } from '@/lib/theme';
import { FONT_SIZE, ICON_SIZE, TOUCH_TARGET } from '@/lib/typography';
import type { MessageVM } from '@iconicedu/shared-types';
import { EmojiPicker } from './emoji-picker';
import { AttachmentSheet, type AttachmentPayload } from './attachment-sheet';
import { ThumbsUp, Plus, ArrowUp, X, FileText, Play, Pause } from 'lucide-react-native';

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

function fmtFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function truncatePlaceholder(value?: string, maxLength = 25): string {
  const text = value?.trim() || 'Type your message';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

const DEFAULT_INPUT_HEIGHT = 20;
const MAX_INPUT_HEIGHT = 120;

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
      borderTopWidth: 1,
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
      borderTopWidth: 1,
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
    // File item — matches message-item file row style
    attachFileItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      maxWidth: 260,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    attachFileIcon: {
      width: ICON_SIZE['2xl'],
      height: ICON_SIZE['2xl'],
      borderRadius: 8,
      backgroundColor: C.tealBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attachFileName: {
      fontSize: FONT_SIZE.base,
      fontWeight: '500' as const,
      color: C.text,
    },
    attachFileSize: {
      fontSize: 11,
      marginTop: 1,
      color: C.textMuted,
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
      width: TOUCH_TARGET.sm,
      height: TOUCH_TARGET.sm,
      borderRadius: 18,
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

    // Progress bar — sits just above the hairline border while sending
    progressBarWrap: {
      height: 2,
      backgroundColor: 'transparent',
      overflow: 'hidden' as const,
    },
    progressBarFill: {
      height: 2,
      backgroundColor: C.teal,
    },

    // Main input bar
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
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
      width: TOUCH_TARGET.md,
      height: TOUCH_TARGET.md,
      borderRadius: 22,
      backgroundColor: C.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Pill input row
    pill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: TOUCH_TARGET.md,
      backgroundColor: C.inputBg,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    input: {
      flex: 1,
      fontSize: FONT_SIZE.md,
      color: C.text,
      lineHeight: 20,
      paddingVertical: 0,
      minHeight: DEFAULT_INPUT_HEIGHT,
      maxHeight: MAX_INPUT_HEIGHT,
      // 'top' is correct for multiline; iOS ignores this but Android needs it
      textAlignVertical: 'top',
    },

    // Emoji button — right of pill (replaces send when input is empty)
    emojiBtn: {
      width: TOUCH_TARGET.md,
      height: TOUCH_TARGET.md,
      borderRadius: 22,
      backgroundColor: C.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Send button — right of pill
    sendBtn: {
      width: TOUCH_TARGET.md,
      height: TOUCH_TARGET.md,
      borderRadius: 22,
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
  const [inputKey, setInputKey] = useState(0);
  const [sending, setSending] = useState(false);
  const sendProgress = useRef(new Animated.Value(0)).current;
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentPayload[]>([]);
  const [loadedImageUris, setLoadedImageUris] = useState<Set<string>>(new Set());
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const audioSoundRef = useRef<AudioPlayer | null>(null);
  const audioSubRef = useRef<{ remove(): void } | null>(null);
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

  // Bump this key to force-remount the native TextInput on iOS after a
  // programmatic setText(''), which otherwise leaves the view at its expanded
  // height (iOS UITextView doesn't re-measure on programmatic clear).
  const resetIOSInput = useCallback(() => {
    if (Platform.OS !== 'ios') return;
    setInputKey((k) => k + 1);
    // Re-focus after remount so the keyboard stays up
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const runSendProgress = useCallback(
    async (send: () => Promise<void>) => {
      setSending(true);
      sendProgress.setValue(0);
      // Race to 85% while the send is in flight
      Animated.timing(sendProgress, {
        toValue: 0.85,
        duration: 500,
        useNativeDriver: false,
      }).start();
      try {
        await send();
      } finally {
        // Complete to 100% then hide
        Animated.timing(sendProgress, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }).start(() => setSending(false));
      }
    },
    [sendProgress],
  );

  const handleSend = useCallback(async () => {
    if (pendingAttachments.length > 0) {
      const attachments = pendingAttachments;
      const caption = text.trim() || undefined;
      setPendingAttachments([]);
      setText('');
      resetIOSInput();
      onTypingStop?.();
      await clearPendingAudio();
      await runSendProgress(
        () => onSendAttachment?.(attachments, caption) ?? Promise.resolve(),
      );
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    resetIOSInput();
    onTypingStop?.();
    await runSendProgress(() => Promise.resolve(onSend(trimmed)));
  }, [
    text,
    pendingAttachments,
    onSend,
    onSendAttachment,
    onTypingStop,
    clearPendingAudio,
    resetIOSInput,
    runSendProgress,
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

  const handleEmojiSelect = useCallback(
    async (emoji: string) => {
      setEmojiPickerVisible(false);
      await runSendProgress(() => Promise.resolve(onSend(emoji)));
    },
    [onSend, runSendProgress],
  );

  const canSend = (text.trim().length > 0 || pendingAttachments.length > 0) && !disabled;
  const resolvedPlaceholder = truncatePlaceholder(placeholder);

  return (
    <>
      {/* Reply-in-thread preview banner */}
      {replyTo && (
        <View style={s.replyPreview}>
          <View style={s.replyAccent} />
          <View style={s.replyInfo}>
            <RoleNameIndicator
              name={replyTo.core.sender.profile.displayName}
              role={replyTo.core.sender.kind}
              textStyle={s.replySender}
              numberOfLines={1}
              iconSize={12}
            />
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
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
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
                  <View style={s.attachFileIcon}>
                    <FileText size={20} color={colors.teal} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.attachFileName} numberOfLines={1}>
                      {a.name}
                    </Text>
                    {!!a.size && (
                      <Text style={s.attachFileSize}>{fmtFileSize(a.size)}</Text>
                    )}
                  </View>
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

      {/* Progress bar — shown just above the hairline border while sending */}
      {sending && (
        <View style={s.progressBarWrap}>
          <Animated.View
            style={[
              s.progressBarFill,
              {
                width: sendProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
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

        {/* Pill: text input only */}
        <View style={s.pill}>
          <TextInput
            key={Platform.OS === 'ios' ? inputKey : undefined}
            ref={inputRef}
            style={s.input}
            value={text}
            onChangeText={handleChangeText}
            placeholder={resolvedPlaceholder}
            placeholderTextColor={colors.textFaint}
            multiline
            scrollEnabled
            editable={!disabled}
            accessibilityLabel="Message input"
          />
        </View>

        {/* Right action button — send when typing, emoji picker when idle */}
        {canSend ? (
          <TouchableOpacity
            style={s.sendBtn}
            onPress={() => {
              void handleSend();
            }}
            activeOpacity={0.8}
            accessibilityLabel="Send message"
          >
            <ArrowUp size={20} color={colors.tealFg} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={s.emojiBtn}
            disabled={disabled}
            activeOpacity={0.7}
            onPress={() => setEmojiPickerVisible(true)}
            accessibilityLabel="Open emoji picker"
          >
            <ThumbsUp size={20} color={colors.teal} />
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
