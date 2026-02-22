import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Share,
} from 'react-native';
import type { MessageVM } from '@iconicedu/shared-types';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import { EmojiPicker, QUICK_EMOJIS } from './emoji-picker';

type MessageActionsSheetProps = {
  visible: boolean;
  message: MessageVM | null;
  isOwn: boolean;
  onClose: () => void;
  onReact: (messageId: string, emoji: string) => void;
  onThread: (message: MessageVM) => void;
  onDelete: (messageId: string) => void;
};

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: {
      backgroundColor: C.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 40,
    },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: C.border,
      alignSelf: 'center', marginTop: 10, marginBottom: 16,
    },

    // Quick reactions
    reactionsRow: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      justifyContent: 'space-around',
      alignItems: 'center',
    },
    reactionBtn: {
      width: 46, height: 46, borderRadius: 23,
      backgroundColor: C.inputBg,
      borderWidth: 1, borderColor: C.border,
      alignItems: 'center', justifyContent: 'center',
    },
    reactionEmoji: { fontSize: 22 },
    moreBtn: {
      width: 46, height: 46, borderRadius: 23,
      backgroundColor: C.inputBg,
      borderWidth: 1, borderColor: C.border,
      alignItems: 'center', justifyContent: 'center',
    },
    moreTxt: { fontSize: 22, color: C.textMuted, lineHeight: 26 },

    // Action list
    actionItem: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingHorizontal: 20, paddingVertical: 16,
    },
    actionIcon: { fontSize: 18, width: 26, textAlign: 'center' },
    actionTxt: { fontSize: 15, color: C.text, flex: 1 },
    destructive: { color: '#ef4444' },
    divider: { height: 1, backgroundColor: C.border },
  });
}

export const MessageActionsSheet: React.FC<MessageActionsSheetProps> = ({
  visible,
  message,
  isOwn,
  onClose,
  onReact,
  onThread,
  onDelete,
}) => {
  const { colors } = useTheme();
  const s = React.useMemo(() => makeStyles(colors), [colors]);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);

  const handleReact = useCallback(
    (emoji: string) => {
      if (!message) return;
      onReact(message.ids.id, emoji);
      onClose();
    },
    [message, onReact, onClose],
  );

  const handleShare = useCallback(async () => {
    const text = (message as { content?: { text?: string } })?.content?.text ?? '';
    if (text) await Share.share({ message: text });
    onClose();
  }, [message, onClose]);

  const handleThread = useCallback(() => {
    if (!message) return;
    onThread(message);
    onClose();
  }, [message, onThread, onClose]);

  const handleDelete = useCallback(() => {
    if (!message) return;
    onDelete(message.ids.id);
    onClose();
  }, [message, onDelete, onClose]);

  const textContent = (message as { content?: { text?: string } })?.content?.text ?? '';

  if (!message) return null;

  // Show 6 quick reactions (first 6 of QUICK_EMOJIS) + "+" for full picker
  const quickSix = QUICK_EMOJIS.slice(0, 6);

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

              {/* Quick reaction row */}
              <View style={s.reactionsRow}>
                {quickSix.map((e) => (
                  <TouchableOpacity key={e} style={s.reactionBtn} onPress={() => handleReact(e)}>
                    <Text style={s.reactionEmoji}>{e}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={s.moreBtn} onPress={() => setEmojiPickerVisible(true)}>
                  <Text style={s.moreTxt}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Thread reply */}
              <TouchableOpacity style={s.actionItem} onPress={handleThread}>
                <Text style={s.actionIcon}>💬</Text>
                <Text style={s.actionTxt}>Reply in thread</Text>
              </TouchableOpacity>

              {/* Share/copy text — only for text messages */}
              {!!textContent && (
                <>
                  <View style={s.divider} />
                  <TouchableOpacity style={s.actionItem} onPress={handleShare}>
                    <Text style={s.actionIcon}>📋</Text>
                    <Text style={s.actionTxt}>Share text</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Delete — own messages only */}
              {isOwn && (
                <>
                  <View style={s.divider} />
                  <TouchableOpacity style={s.actionItem} onPress={handleDelete}>
                    <Text style={[s.actionIcon, s.destructive]}>🗑</Text>
                    <Text style={[s.actionTxt, s.destructive]}>Delete message</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Full emoji picker — shown on top of actions sheet */}
      <EmojiPicker
        visible={emojiPickerVisible}
        onClose={() => setEmojiPickerVisible(false)}
        onEmojiSelect={handleReact}
      />
    </>
  );
};
