import React, { useState, useCallback } from 'react';
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

const EMOJI_CATEGORIES: { icon: string; label: string; emojis: string[] }[] = [
  {
    icon: '😊',
    label: 'Smileys',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '😉', '😍', '🥰', '😘', '😋', '😛', '😜', '🤩', '😮',
      '😲', '🥳', '😢', '😭', '😤', '😠', '🤬', '🤯', '😱', '😎',
    ],
  },
  {
    icon: '👍',
    label: 'Gestures',
    emojis: [
      '👍', '👎', '👏', '🙌', '🤝', '🤜', '🤛', '✊', '👊', '🤚',
      '👋', '🖐', '✋', '💪', '🙏', '🤲', '👐', '🤞', '🤟', '🤘',
    ],
  },
  {
    icon: '❤️',
    label: 'Hearts',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💕',
      '💞', '💓', '💗', '💖', '💘', '💝', '💟', '❣️', '💔', '🔥',
    ],
  },
  {
    icon: '📚',
    label: 'Education',
    emojis: [
      '📚', '📖', '✏️', '📝', '📒', '📓', '📔', '📕', '📗', '📘',
      '📙', '📋', '📌', '📎', '✂️', '🔬', '🔭', '📐', '📏', '🗒️',
      '📊', '📈', '📉', '🗂️', '🏆', '🥇', '🎓', '🖊️', '🖋️', '✒️',
    ],
  },
  {
    icon: '🎉',
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
      backgroundColor: C.pageBg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 8,
      maxHeight: '70%',
    },
    handle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: C.border,
      alignSelf: 'center', marginBottom: 4,
    },

    // Category tab bar
    tabBarWrapper: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    tabBarInner: {
      flexDirection: 'row',
      paddingHorizontal: 8,
    },
    tab: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: C.teal,
    },
    tabIcon: { fontSize: 20 },

    // Emoji grid
    emojiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: 32,
    },
    emojiBtn: {
      width: '12.5%',
      paddingVertical: 7,
      alignItems: 'center',
    },
    emojiTxt: { fontSize: 26 },
  });
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ visible, onClose, onEmojiSelect }) => {
  const { colors } = useTheme();
  const s = React.useMemo(() => makeStyles(colors), [colors]);
  const [activeIdx, setActiveIdx] = useState(0);

  const handleEmoji = useCallback(
    (emoji: string) => {
      onEmojiSelect(emoji);
      onClose();
    },
    [onEmojiSelect, onClose],
  );

  const activeEmojis = EMOJI_CATEGORIES[activeIdx]?.emojis ?? [];

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

              {/* Category tab bar */}
              <View style={s.tabBarWrapper}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.tabBarInner}
                >
                  {EMOJI_CATEGORIES.map((cat, i) => (
                    <TouchableOpacity
                      key={cat.label}
                      style={[s.tab, i === activeIdx && s.tabActive]}
                      onPress={() => setActiveIdx(i)}
                    >
                      <Text style={s.tabIcon}>{cat.icon}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Emoji grid for active category */}
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={s.emojiGrid}>
                  {activeEmojis.map((e) => (
                    <TouchableOpacity key={e} style={s.emojiBtn} onPress={() => handleEmoji(e)}>
                      <Text style={s.emojiTxt}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
