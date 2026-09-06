import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Share,
  Alert,
  Animated,
} from 'react-native';
import type { MessageVM } from '@iconicedu/shared-types';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import { EmojiPicker } from './emoji-picker';
import {
  MessageCircle,
  Bookmark,
  Copy,
  Forward,
  EyeOff,
  Trash2,
  SmilePlus,
} from 'lucide-react-native';

// Facebook Messenger-style quick reactions
const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

type MessageActionsSheetProps = {
  visible: boolean;
  message: MessageVM | null;
  isOwn: boolean;
  /** When true, hides reactions, thread reply, and destructive actions (supervised read-only mode). */
  isReadOnly?: boolean;
  onClose: () => void;
  onReact: (messageId: string, emoji: string) => void;
  onThread: (message: MessageVM) => void;
  onDelete: (messageId: string) => void;
  onSave?: (messageId: string, saved: boolean) => void;
  onHide?: (messageId: string) => void;
};

// ─── Animated reaction bubble (Facebook Messenger style) ──────────────────────

function ReactionBubble({
  emoji,
  onPress,
  colors,
}: {
  emoji: string;
  onPress: (e: string) => void;
  colors: AppColors;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    // Trigger callback immediately, animate simultaneously
    onPress(emoji);
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1.5,
        useNativeDriver: true,
        damping: 4,
        stiffness: 350,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 10,
        stiffness: 200,
      }),
    ]).start();
  }, [emoji, onPress, scale]);

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.75}>
      <Animated.View
        style={[
          bubbleStyles.bubble,
          { backgroundColor: colors.inputBg, borderColor: colors.border },
          { transform: [{ scale }] },
        ]}
      >
        <Text style={bubbleStyles.emoji}>{emoji}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const bubbleStyles = StyleSheet.create({
  bubble: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 26 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: C.modalOverlay },
    sheet: {
      backgroundColor: C.pageBg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: 40,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 20,
    },

    // Reaction row
    reactionsRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingBottom: 18,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
      justifyContent: 'space-around',
      alignItems: 'center',
    },
    moreEmojiBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: C.inputBg,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moreTxt: { fontSize: 20, color: C.textMuted, fontWeight: '700', lineHeight: 24 },

    // Action items
    actionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 20,
      paddingVertical: 15,
    },
    actionIcon: { fontSize: 20, width: 28, textAlign: 'center' },
    actionLabel: { fontSize: 17, color: C.text },
    savedLabel: { fontSize: 17, color: C.teal, fontWeight: '600' },
    destructive: { color: C.red },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: C.border,
      marginHorizontal: 20,
    },
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export const MessageActionsSheet: React.FC<MessageActionsSheetProps> = ({
  visible,
  message,
  isOwn,
  isReadOnly = false,
  onClose,
  onReact,
  onThread,
  onDelete,
  onSave,
  onHide,
}) => {
  const { colors } = useTheme();
  const s = React.useMemo(() => makeStyles(colors), [colors]);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [saved, setSaved] = useState(false);
  const messageId = message?.ids.id;
  const isMessageSaved =
    (message?.state as { isSaved?: boolean } | undefined)?.isSaved ?? false;

  // Sync saved state when the message changes
  useEffect(() => {
    setSaved(isMessageSaved);
  }, [messageId, isMessageSaved]);

  const handleReact = useCallback(
    (emoji: string) => {
      if (!message) return;
      onReact(message.ids.id, emoji);
      onClose();
    },
    [message, onReact, onClose],
  );

  const handleThread = useCallback(() => {
    if (!message) return;
    onThread(message);
    onClose();
  }, [message, onThread, onClose]);

  const handleSave = useCallback(() => {
    if (!message) return;
    const next = !saved;
    setSaved(next);
    onSave?.(message.ids.id, next);
    onClose();
  }, [message, saved, onSave, onClose]);

  const handleCopyText = useCallback(async () => {
    const text = (message as { content?: { text?: string } })?.content?.text ?? '';
    if (text) {
      await Share.share({ message: text });
    }
    onClose();
  }, [message, onClose]);

  const handleForward = useCallback(async () => {
    const text = (message as { content?: { text?: string } })?.content?.text ?? '';
    if (text) {
      await Share.share({ message: text });
    } else {
      onClose();
    }
  }, [message, onClose]);

  const handleHide = useCallback(() => {
    if (!message) return;
    onHide?.(message.ids.id);
    onClose();
  }, [message, onHide, onClose]);

  const handleDelete = useCallback(() => {
    if (!message) return;
    Alert.alert(
      'Delete message?',
      'This action cannot be undone. This message will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(message.ids.id);
            onClose();
          },
        },
      ],
    );
  }, [message, onDelete, onClose]);

  const textContent = (message as { content?: { text?: string } })?.content?.text ?? '';

  if (!message) return null;

  return (
    <>
      <Modal
        visible={visible && !emojiPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <Pressable style={s.overlay} onPress={onClose}>
          <Pressable>
            <View style={s.sheet}>
              <View style={s.handle} />

              {/* Facebook Messenger-style animated quick reactions — hidden in read-only mode */}
              {!isReadOnly && (
                <View style={s.reactionsRow}>
                  {QUICK_REACTIONS.map((e) => (
                    <ReactionBubble
                      key={e}
                      emoji={e}
                      onPress={handleReact}
                      colors={colors}
                    />
                  ))}
                  <TouchableOpacity
                    style={s.moreEmojiBtn}
                    onPress={() => setEmojiPickerVisible(true)}
                  >
                    <SmilePlus size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Reply in thread — hidden in read-only mode */}
              {!isReadOnly && (
                <TouchableOpacity style={s.actionItem} onPress={handleThread}>
                  <MessageCircle size={20} color={colors.text} />
                  <Text style={s.actionLabel}>Reply in thread</Text>
                </TouchableOpacity>
              )}

              {/* Save / Unsave */}
              <TouchableOpacity style={s.actionItem} onPress={handleSave}>
                <Bookmark size={20} color={saved ? colors.teal : colors.text} />
                <Text style={saved ? s.savedLabel : s.actionLabel}>
                  {saved ? 'Saved' : 'Save message'}
                </Text>
              </TouchableOpacity>

              {/* Copy text + Forward — text messages only */}
              {!!textContent && (
                <>
                  <View style={s.divider} />
                  <TouchableOpacity style={s.actionItem} onPress={handleCopyText}>
                    <Copy size={20} color={colors.text} />
                    <Text style={s.actionLabel}>Copy text</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.actionItem} onPress={handleForward}>
                    <Forward size={20} color={colors.text} />
                    <Text style={s.actionLabel}>Forward</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Own message destructive actions — hidden in read-only mode */}
              {!isReadOnly && isOwn && (
                <>
                  <View style={s.divider} />
                  {!!onHide && (
                    <TouchableOpacity style={s.actionItem} onPress={handleHide}>
                      <EyeOff size={20} color={colors.text} />
                      <Text style={s.actionLabel}>Hide message</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={s.actionItem} onPress={handleDelete}>
                    <Trash2 size={20} color="#ef4444" />
                    <Text style={[s.actionLabel, s.destructive]}>Delete message</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Full emoji picker sheet */}
      <EmojiPicker
        visible={emojiPickerVisible}
        onClose={() => setEmojiPickerVisible(false)}
        onEmojiSelect={handleReact}
      />
    </>
  );
};
