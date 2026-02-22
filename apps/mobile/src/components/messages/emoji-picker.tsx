import React, { useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

export const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '✅', '🙏'];

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '😉', '😍', '🥰', '😘', '😋', '😛', '😜', '🤩', '😮',
      '😲', '🥳', '😢', '😭', '😤', '😠', '🤬', '🤯', '😱', '😎',
    ],
  },
  {
    label: 'Gestures',
    emojis: [
      '👍', '👎', '👏', '🙌', '🤝', '🤜', '🤛', '✊', '👊', '🤚',
      '👋', '🖐', '✋', '💪', '🙏', '🤲', '👐', '🤞', '🤟', '🤘',
    ],
  },
  {
    label: 'Hearts',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💕',
      '💞', '💓', '💗', '💖', '💘', '💝', '💟', '❣️', '💔', '🔥',
    ],
  },
  {
    label: 'Education',
    emojis: [
      '📚', '📖', '✏️', '📝', '📒', '📓', '📔', '📕', '📗', '📘',
      '📙', '📋', '📌', '📎', '✂️', '🔬', '🔭', '📐', '📏', '🗒️',
      '📊', '📈', '📉', '🗂️', '🏆', '🥇', '🎓', '🖊️', '🖋️', '✒️',
    ],
  },
  {
    label: 'Celebrate',
    emojis: [
      '🎉', '🎊', '🎈', '🎁', '🥳', '🎂', '🍾', '🥂', '🎆', '🎇',
      '✨', '⭐', '🌟', '💫', '🔥', '✅', '☑️', '💯', '🏅', '🎖️',
    ],
  },
];

type EmojiPickerProps = {
  visible: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
};

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      backgroundColor: C.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 8,
      maxHeight: '65%',
    },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: C.border,
      alignSelf: 'center', marginBottom: 12,
    },
    quickRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      justifyContent: 'space-around',
    },
    quickBtn: {
      width: 42, height: 42, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: C.inputBg,
    },
    categoryLabel: {
      fontSize: 11, fontWeight: '700', color: C.textFaint,
      paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
      textTransform: 'uppercase', letterSpacing: 0.8,
    },
    emojiGrid: {
      flexDirection: 'row', flexWrap: 'wrap',
      paddingHorizontal: 8,
      paddingBottom: 8,
    },
    emojiBtn: {
      width: '12.5%', // 8 per row
      paddingVertical: 6,
      alignItems: 'center', justifyContent: 'center',
    },
    emojiTxt: { fontSize: 24 },
  });
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ visible, onClose, onEmojiSelect }) => {
  const { colors } = useTheme();
  const s = React.useMemo(() => makeStyles(colors), [colors]);

  const handleEmoji = useCallback(
    (emoji: string) => {
      onEmojiSelect(emoji);
      onClose();
    },
    [onEmojiSelect, onClose],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.overlay}>
          <TouchableWithoutFeedback>
            <View style={s.sheet}>
              <View style={s.handle} />

              {/* Quick reactions row */}
              <View style={s.quickRow}>
                {QUICK_EMOJIS.map((e) => (
                  <TouchableOpacity key={e} style={s.quickBtn} onPress={() => handleEmoji(e)}>
                    <Text style={s.emojiTxt}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Categorised grid */}
              <ScrollView showsVerticalScrollIndicator={false}>
                {EMOJI_CATEGORIES.map((cat) => (
                  <View key={cat.label}>
                    <Text style={s.categoryLabel}>{cat.label}</Text>
                    <View style={s.emojiGrid}>
                      {cat.emojis.map((e) => (
                        <TouchableOpacity key={e} style={s.emojiBtn} onPress={() => handleEmoji(e)}>
                          <Text style={s.emojiTxt}>{e}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
