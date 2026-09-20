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
import type { MessageMentionVM, MessageVM } from '@iconicedu/shared-types';
import { EmojiPicker } from './emoji-picker';
import { AttachmentSheet, type AttachmentPayload } from './attachment-sheet';
import {
  ThumbsUp,
  Plus,
  ArrowUp,
  X,
  FileText,
  Play,
  Pause,
  Bold,
  Italic,
  Check,
} from 'lucide-react-native';
import { useMessageDraft, type MessageDraftScope } from '@/hooks/use-message-draft';
import { generateClientMessageId } from '@/lib/messages/client-message-id';
import {
  applyInlineFormat,
  type TextSelection,
} from '@/lib/messages/message-input-formatting';
import {
  disambiguateMentionCandidateLabels,
  extractMentionsFromMessageText,
  getMentionState,
  insertMention,
  rankMentionCandidates,
  type MentionCandidate,
} from '@/lib/messages/message-mentions';

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

/** Extra data attached to a send when mentions/send-reliability are enabled. */
export type MessageSendMeta = {
  mentions?: MessageMentionVM[];
  /** Present when enableSendReliability is on — reuse it verbatim on retry. */
  clientMessageId?: string;
};

/** Message currently being edited — drives the composer's edit mode. */
export type EditingMessageContext = {
  messageId: string;
  content: string;
  mentions?: MessageMentionVM[];
};

type MessageInputProps = {
  onSend: (text: string, meta?: MessageSendMeta) => void | Promise<void>;
  /** Called with picked/recorded attachments and optional caption — caller handles upload + send. */
  onSendAttachment?: (
    attachments: AttachmentPayload[],
    caption?: string,
    clientMessageId?: string,
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

  // ── Automatic drafts (issue #264 capability #1) — gate with enableMessageDrafts ──
  enableDrafts?: boolean;
  /** Identifies this composer for AsyncStorage draft scoping. Required when enableDrafts is true. */
  draftScope?: MessageDraftScope;

  // ── Edit sent text messages (capability #4) — gate with enableMessageEdit ──
  /** Non-null puts the composer into edit mode, prefilled with this message's text. */
  editingMessage?: EditingMessageContext | null;
  /** Return true on a successful save; the composer exits edit mode only then. */
  onSaveEdit?: (input: {
    messageId: string;
    content: string;
    mentions?: MessageMentionVM[];
  }) => Promise<boolean>;
  onCancelEdit?: () => void;

  // ── Classroom-aware mentions authoring (capability #5) — gate with enableMobileMessageComposerParity ──
  enableMentions?: boolean;
  /** Channel/DM participants eligible to be @mentioned (current user already excluded). */
  mentionCandidates?: MentionCandidate[];

  // ── Bold/italic formatting authoring (capability #6) — gate with enableMobileMessageComposerParity ──
  enableFormatting?: boolean;

  // ── Send-failure recovery (capability #2) — gate with enableMessageSendReliability ──
  /** When true, onSend receives a fresh clientMessageId in `meta` on every attempt. */
  enableSendReliability?: boolean;
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

    // Edit mode: Save / Cancel buttons replace the send/emoji button
    editCancelBtn: {
      height: 40,
      paddingHorizontal: 14,
      borderRadius: 20,
      backgroundColor: C.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editCancelTxt: { fontSize: 14, fontWeight: '600', color: C.textMuted },
    editSaveBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: C.teal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 6,
      backgroundColor: C.tealBg,
    },
    editBannerTxt: { fontSize: 12, fontWeight: '600', color: C.teal },

    // Draft status hint ("Draft saved" / "Draft restored")
    draftStatus: {
      paddingHorizontal: 16,
      paddingTop: 4,
      backgroundColor: C.bg,
    },
    draftStatusTxt: { fontSize: 12, color: C.textFaint },

    // Formatting toolbar (Bold / Italic)
    formattingToolbar: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 6,
      backgroundColor: C.bg,
    },
    formattingBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },

    // Mention suggestions list — sits directly above the input bar
    mentionList: {
      maxHeight: 200,
      backgroundColor: C.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
    },
    mentionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
    },
    mentionItemLabel: { fontSize: 15, color: C.text, fontWeight: '500' },
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
  enableDrafts = false,
  draftScope,
  editingMessage = null,
  onSaveEdit,
  onCancelEdit,
  enableMentions = false,
  mentionCandidates = [],
  enableFormatting = false,
  enableSendReliability = false,
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
  const [selection, setSelection] = useState<TextSelection>({ start: 0, end: 0 });
  const [savingEdit, setSavingEdit] = useState(false);
  const audioSoundRef = useRef<AudioPlayer | null>(null);
  const audioSubRef = useRef<{ remove(): void } | null>(null);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const s = React.useMemo(
    () => makeStyles(colors, insets.bottom, keyboardVisible),
    [colors, insets.bottom, keyboardVisible],
  );

  const isEditing = !!editingMessage;

  // ── Automatic drafts ──────────────────────────────────────────────────────
  const draft = useMessageDraft(draftScope ?? null, enableDrafts && !!draftScope);

  // Restore a saved draft once, as long as the composer is otherwise empty
  // (never clobber an active reply-in-progress or an edit-in-progress).
  const draftRestoreAppliedRef = useRef(false);
  useEffect(() => {
    if (
      !enableDrafts ||
      !draft.isRestored ||
      draftRestoreAppliedRef.current ||
      isEditing ||
      text.length > 0
    ) {
      return;
    }
    draftRestoreAppliedRef.current = true;
    if (draft.restoredDraft?.content) {
      setText(draft.restoredDraft.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableDrafts, draft.isRestored, draft.restoredDraft, isEditing]);

  // Reset the "already restored" guard when the composer's scope changes
  // (e.g. navigating to a different channel/thread).
  useEffect(() => {
    draftRestoreAppliedRef.current = false;
  }, [draftScope?.channelId, draftScope?.threadId]);

  // ── Edit mode ─────────────────────────────────────────────────────────────
  // Seed the input with the message's current text whenever edit mode is entered.
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [editingMessage]);

  // ── Mention autocomplete ──────────────────────────────────────────────────
  const mentionState = enableMentions ? getMentionState(text, selection.start) : null;
  const mentionSuggestions = React.useMemo(() => {
    if (!mentionState) return [];
    const ranked = rankMentionCandidates(mentionCandidates, mentionState.query);
    return disambiguateMentionCandidateLabels(ranked).slice(0, 6);
  }, [mentionState, mentionCandidates]);

  const handleSelectMention = useCallback(
    (candidate: { id: string; label: string; displayName: string }) => {
      if (!mentionState) return;
      const result = insertMention(
        text,
        { start: mentionState.start, end: mentionState.end },
        candidate.displayName,
      );
      setText(result.nextValue);
      setSelection({ start: result.caret, end: result.caret });
      requestAnimationFrame(() => {
        inputRef.current?.setNativeProps({
          selection: { start: result.caret, end: result.caret },
        });
      });
    },
    [mentionState, text],
  );

  // ── Bold / italic formatting toolbar ─────────────────────────────────────
  const applyFormatting = useCallback(
    (wrapper: '**' | '*') => {
      const result = applyInlineFormat(text, selection, wrapper);
      setText(result.nextValue);
      setSelection(result.selection);
      requestAnimationFrame(() => {
        inputRef.current?.setNativeProps({ selection: result.selection });
      });
      if (enableDrafts && !isEditing) {
        draft.notifyContentChanged(result.nextValue);
      }
    },
    [text, selection, enableDrafts, isEditing, draft],
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
      const clientMessageId = enableSendReliability
        ? generateClientMessageId()
        : undefined;
      setPendingAttachments([]);
      setText('');
      resetIOSInput();
      onTypingStop?.();
      await clearPendingAudio();
      await runSendProgress(
        () =>
          onSendAttachment?.(attachments, caption, clientMessageId) ?? Promise.resolve(),
      );
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    resetIOSInput();
    onTypingStop?.();

    const meta: MessageSendMeta = {};
    if (enableMentions && mentionCandidates.length) {
      const extracted = extractMentionsFromMessageText(trimmed, mentionCandidates);
      if (extracted.length) meta.mentions = extracted;
    }
    if (enableSendReliability) {
      meta.clientMessageId = generateClientMessageId();
    }
    const hasMeta = Object.keys(meta).length > 0;

    try {
      await runSendProgress(() =>
        Promise.resolve(hasMeta ? onSend(trimmed, meta) : onSend(trimmed)),
      );
      // Only clear the draft once the send is confirmed. When send-reliability
      // is enabled the caller rethrows on failure so we keep the draft; legacy
      // callers swallow the error internally (and already show their own
      // alert), so clearing here matches the pre-existing optimistic-clear UX.
      if (enableDrafts) {
        await draft.clearDraft();
      }
    } catch {
      // Failure — leave any persisted draft in place so the user's text isn't
      // lost. The parent screen (when send-reliability is on) is responsible
      // for showing a "Not sent" retry affordance; this component only owns
      // the composer's own text field, which is already optimistically clear.
    }
  }, [
    text,
    pendingAttachments,
    onSend,
    onSendAttachment,
    onTypingStop,
    clearPendingAudio,
    resetIOSInput,
    runSendProgress,
    enableMentions,
    mentionCandidates,
    enableSendReliability,
    enableDrafts,
    draft,
  ]);

  const handleChangeText = useCallback(
    (t: string) => {
      setText(t);
      if (t.length > 0) {
        onTypingChange?.();
      } else {
        onTypingStop?.();
      }
      if (enableDrafts && !isEditing) {
        draft.dismissStatus();
        draft.notifyContentChanged(t);
      }
    },
    [onTypingChange, onTypingStop, enableDrafts, isEditing, draft],
  );

  const handleEmojiSelect = useCallback(
    async (emoji: string) => {
      setEmojiPickerVisible(false);
      await runSendProgress(() => Promise.resolve(onSend(emoji)));
    },
    [onSend, runSendProgress],
  );

  const handleSaveEdit = useCallback(async () => {
    if (!editingMessage || !onSaveEdit) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const mentions =
      enableMentions && mentionCandidates.length
        ? extractMentionsFromMessageText(trimmed, mentionCandidates)
        : undefined;

    setSavingEdit(true);
    try {
      const ok = await onSaveEdit({
        messageId: editingMessage.messageId,
        content: trimmed,
        mentions: mentions?.length ? mentions : undefined,
      });
      if (ok) {
        onCancelEdit?.();
      }
    } finally {
      setSavingEdit(false);
    }
  }, [editingMessage, onSaveEdit, onCancelEdit, text, enableMentions, mentionCandidates]);

  const handleCancelEdit = useCallback(() => {
    setText('');
    onCancelEdit?.();
  }, [onCancelEdit]);

  const canSend = (text.trim().length > 0 || pendingAttachments.length > 0) && !disabled;
  const resolvedPlaceholder = truncatePlaceholder(placeholder);
  const canSaveEdit = text.trim().length > 0 && !savingEdit;

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

      {/* Edit mode banner */}
      {isEditing && (
        <View style={s.editBanner}>
          <Text style={s.editBannerTxt}>Editing message</Text>
        </View>
      )}

      {/* Draft status hint — only ever shown outside edit mode */}
      {enableDrafts && !isEditing && draft.status !== 'idle' && (
        <View style={s.draftStatus}>
          <Text style={s.draftStatusTxt} accessibilityLabel={`Draft ${draft.status}`}>
            {draft.status === 'restored' ? 'Draft restored' : 'Draft saved'}
          </Text>
        </View>
      )}

      {/* Bold / italic formatting toolbar */}
      {enableFormatting && (
        <View style={s.formattingToolbar}>
          <TouchableOpacity
            style={s.formattingBtn}
            onPress={() => applyFormatting('**')}
            activeOpacity={0.7}
            accessibilityLabel="Bold"
            accessibilityRole="button"
          >
            <Bold size={16} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.formattingBtn}
            onPress={() => applyFormatting('*')}
            activeOpacity={0.7}
            accessibilityLabel="Italic"
            accessibilityRole="button"
          >
            <Italic size={16} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}

      {/* Mention autocomplete suggestions */}
      {enableMentions && mentionState && mentionSuggestions.length > 0 && (
        <ScrollView style={s.mentionList} keyboardShouldPersistTaps="handled">
          {mentionSuggestions.map((candidate) => (
            <TouchableOpacity
              key={candidate.id}
              style={s.mentionItem}
              activeOpacity={0.7}
              onPress={() => handleSelectMention(candidate)}
              accessibilityLabel={`Mention ${candidate.label}`}
            >
              <Text style={s.mentionItemLabel}>{candidate.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={s.bar}>
        {/* + Attachment button — shows spinner while an upload is in flight; hidden while editing */}
        {!isEditing && (
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
        )}

        {/* Pill: text input only */}
        <View style={s.pill}>
          <TextInput
            key={Platform.OS === 'ios' ? inputKey : undefined}
            ref={inputRef}
            style={s.input}
            value={text}
            onChangeText={handleChangeText}
            onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
            placeholder={resolvedPlaceholder}
            placeholderTextColor={colors.textFaint}
            multiline
            scrollEnabled
            editable={!disabled}
            accessibilityLabel="Message input"
          />
        </View>

        {/* Right action area: Save/Cancel while editing; send/emoji otherwise */}
        {isEditing ? (
          <>
            <TouchableOpacity
              style={s.editCancelBtn}
              onPress={handleCancelEdit}
              activeOpacity={0.7}
              accessibilityLabel="Cancel edit"
            >
              <Text style={s.editCancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.editSaveBtn}
              onPress={() => {
                void handleSaveEdit();
              }}
              disabled={!canSaveEdit}
              activeOpacity={0.8}
              accessibilityLabel="Save edit"
            >
              {savingEdit ? (
                <ActivityIndicator size="small" color={colors.tealFg} />
              ) : (
                <Check size={20} color={colors.tealFg} />
              )}
            </TouchableOpacity>
          </>
        ) : canSend ? (
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
