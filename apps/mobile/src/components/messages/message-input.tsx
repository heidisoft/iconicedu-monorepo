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
import type { MessageVM } from '@iconicedu/shared-types';
import { EmojiPicker } from './emoji-picker';
import { AttachmentSheet, type AttachmentPayload } from './attachment-sheet';
import { AiRefineSheet } from './ai-refine-sheet';
import { AiSuggestedReplies } from './ai-suggested-replies';
import {
  ThumbsUp,
  Plus,
  ArrowUp,
  X,
  FileText,
  Play,
  Pause,
  Sparkles,
} from 'lucide-react-native';
import { useMobileFeatureFlag } from '@/hooks/use-mobile-feature-flag';
import { mobileFeatureFlagKeys } from '@/lib/feature-flags';

// Minimum non-whitespace characters typed before "Refine with AI" appears —
// picked within the 10-20 char range called out in issue #264 so the
// affordance only shows once there's a meaningful draft to refine.
const AI_REFINE_MIN_CHARS = 15;
// How long the post-replace "Undo" banner stays up before auto-dismissing.
const AI_REPLACE_UNDO_DURATION_MS = 6000;

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
  /**
   * Org/channel/profile context for the AI-assist features (issue #264).
   * "Refine with AI" and "Suggested replies" only render when all three are
   * provided AND their respective flag resolves true.
   */
  orgId?: string;
  channelId?: string;
  profileId?: string;
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
      fontSize: 13,
      fontWeight: '600',
      color: C.teal,
      marginBottom: 1,
    },
    replyText: {
      fontSize: 13,
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
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: C.tealBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attachFileName: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: C.text,
    },
    attachFileSize: {
      fontSize: 12,
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
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: C.teal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attachAudioLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: C.text,
    },
    attachAudioMeta: {
      fontSize: 12,
      color: C.textMuted,
    },

    // "Refine with AI" trigger — right-aligned slim row above the bar,
    // shown once the draft passes the non-whitespace character threshold.
    refineTriggerRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 12,
      paddingTop: 6,
      backgroundColor: C.bg,
    },
    refineTriggerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: C.tealBg,
    },
    refineTriggerLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: C.teal,
    },

    // Undo banner — shown briefly after "Replace" is accepted from the
    // refine preview, since RN TextInput has no reliable native undo.
    undoBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: C.tealBg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
    },
    undoText: {
      flex: 1,
      fontSize: 13,
      color: C.teal,
    },
    undoAction: {
      fontSize: 13,
      fontWeight: '700',
      color: C.teal,
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
      width: 40,
      height: 40,
      borderRadius: 20,
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
      minHeight: 40,
      backgroundColor: C.inputBg,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: C.text,
      lineHeight: 22,
      paddingVertical: 0,
      minHeight: DEFAULT_INPUT_HEIGHT,
      maxHeight: MAX_INPUT_HEIGHT,
      // 'top' is correct for multiline; iOS ignores this but Android needs it
      textAlignVertical: 'top',
    },

    // Emoji button — right of pill (replaces send when input is empty)
    emojiBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: C.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
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
  orgId,
  channelId,
  profileId,
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
  const [refineSheetVisible, setRefineSheetVisible] = useState(false);
  const [undoBanner, setUndoBanner] = useState<{ previousText: string } | null>(null);
  const audioSoundRef = useRef<AudioPlayer | null>(null);
  const audioSubRef = useRef<{ remove(): void } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const s = React.useMemo(
    () => makeStyles(colors, insets.bottom, keyboardVisible),
    [colors, insets.bottom, keyboardVisible],
  );

  const enableAiRefine = useMobileFeatureFlag(mobileFeatureFlagKeys.enableAiRefine);
  const enableAiSuggestedReplies = useMobileFeatureFlag(
    mobileFeatureFlagKeys.enableAiSuggestedReplies,
  );
  const hasAiContext = Boolean(orgId && channelId && profileId);
  const canUseAiRefine = enableAiRefine && hasAiContext;
  const canUseAiSuggestedReplies = enableAiSuggestedReplies && hasAiContext;
  const nonWhitespaceLength = text.replace(/\s/g, '').length;
  const showRefineTrigger = canUseAiRefine && nonWhitespaceLength >= AI_REFINE_MIN_CHARS;

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

  // Cleanup the AI-replace undo timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
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

  // ── AI-assist (issue #264) ────────────────────────────────────────────────

  const handleRefineReplace = useCallback(
    (refinedText: string) => {
      setRefineSheetVisible(false);
      const previousText = text;
      setUndoBanner({ previousText });
      setText(refinedText);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(
        () => setUndoBanner(null),
        AI_REPLACE_UNDO_DURATION_MS,
      );
    },
    [text],
  );

  const handleUndoReplace = useCallback(() => {
    if (!undoBanner) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setText(undoBanner.previousText);
    setUndoBanner(null);
  }, [undoBanner]);

  const handleSuggestionSelect = useCallback(
    (suggestion: string) => {
      setText(suggestion);
      if (suggestion.length > 0) {
        onTypingChange?.();
      } else {
        onTypingStop?.();
      }
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [onTypingChange, onTypingStop],
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

      {/* AI: Suggested replies — explicit-invoke only, never automatic */}
      {canUseAiSuggestedReplies && (
        <AiSuggestedReplies
          orgId={orgId!}
          channelId={channelId!}
          profileId={profileId!}
          disabled={disabled}
          onSelect={handleSuggestionSelect}
        />
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

      {/* AI: undo banner — shown briefly after "Replace" is accepted */}
      {undoBanner && (
        <View style={s.undoBanner}>
          <Sparkles size={14} color={colors.teal} />
          <Text style={s.undoText}>Draft replaced with an AI suggestion</Text>
          <TouchableOpacity
            onPress={handleUndoReplace}
            accessibilityLabel="Undo AI replace"
          >
            <Text style={s.undoAction}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* AI: "Refine with AI" trigger — appears once the draft has enough content */}
      {showRefineTrigger && (
        <View style={s.refineTriggerRow}>
          <TouchableOpacity
            style={s.refineTriggerBtn}
            onPress={() => setRefineSheetVisible(true)}
            disabled={disabled}
            accessibilityLabel="Refine with AI"
            accessibilityState={{ disabled: disabled ?? false }}
          >
            <Sparkles size={13} color={colors.teal} />
            <Text style={s.refineTriggerLabel}>Refine with AI</Text>
          </TouchableOpacity>
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

      {canUseAiRefine && (
        <AiRefineSheet
          visible={refineSheetVisible}
          onClose={() => setRefineSheetVisible(false)}
          draftText={text}
          orgId={orgId!}
          channelId={channelId!}
          profileId={profileId!}
          onReplace={handleRefineReplace}
        />
      )}
    </>
  );
};
