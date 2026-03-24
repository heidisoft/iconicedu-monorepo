import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  Clock3,
  GraduationCap,
  Hand,
  Heart,
  PartyPopper,
  SmilePlus,
} from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

export const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '✅', '🙏'];

const RECENT_EMOJIS_KEY = 'emoji_picker_recent';
const MAX_RECENT_EMOJIS = 24;

// ─── Module-level singleton ────────────────────────────────────────────────────
// Shared across all EmojiPicker instances so selecting in one picker
// is immediately visible when opening any other picker.

let _recentCache: string[] | null = null;

async function getRecentEmojis(): Promise<string[]> {
  if (_recentCache !== null) return _recentCache;
  try {
    const stored = await SecureStore.getItemAsync(RECENT_EMOJIS_KEY);
    _recentCache = stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    _recentCache = [];
  }
  return _recentCache;
}

function addToRecentCache(emoji: string): string[] {
  const current = _recentCache ?? [];
  const filtered = current.filter((e) => e !== emoji);
  const updated = [emoji, ...filtered].slice(0, MAX_RECENT_EMOJIS);
  _recentCache = updated;
  SecureStore.setItemAsync(RECENT_EMOJIS_KEY, JSON.stringify(updated)).catch(() => {});
  return updated;
}

const EMOJI_CATEGORIES: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  emojis: string[];
}[] = [
  {
    icon: SmilePlus,
    label: 'Smileys',
    emojis: [
      '😀',
      '😃',
      '😄',
      '😁',
      '😅',
      '😊',
      '😇',
      '🥰',
      '😍',
      '🤩',
      '😘',
      '😋',
      '😎',
      '🤓',
      '🧐',
      '🤔',
      '🤗',
      '🤭',
      '😌',
      '😔',
    ],
  },
  {
    icon: Hand,
    label: 'Gestures',
    emojis: [
      '👍',
      '👎',
      '👏',
      '🙌',
      '👊',
      '✊',
      '🤝',
      '🙏',
      '✋',
      '💪',
      '✌️',
      '🤞',
      '👌',
    ],
  },
  {
    icon: Heart,
    label: 'Hearts',
    emojis: [
      '❤️',
      '🧡',
      '💛',
      '💚',
      '💙',
      '💜',
      '🖤',
      '🤍',
      '💕',
      '💞',
      '💓',
      '💗',
      '💖',
      '💘',
    ],
  },
  {
    icon: GraduationCap,
    label: 'Education',
    emojis: [
      '📚',
      '📖',
      '📝',
      '✏️',
      '📌',
      '📍',
      '🎓',
      '🏆',
      '⭐',
      '✨',
      '💡',
      '🔖',
      '📎',
    ],
  },
  {
    icon: PartyPopper,
    label: 'Celebrate',
    emojis: ['🎉', '🎊', '🎈', '🎁', '🏅', '🥈', '🥉', '🌟', '✅', '💯', '🔥', '👑'],
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveTab = 'recent' | number;

type EmojiPickerProps = {
  visible: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
};

// ─── Styles ───────────────────────────────────────────────────────────────────

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
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
      alignSelf: 'center',
      marginBottom: 4,
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
    tabIconWrap: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Section label (inside grid)
    sectionLabel: {
      width: '100%',
      fontSize: 11,
      fontWeight: '600',
      color: C.textMuted,
      paddingHorizontal: 8,
      paddingTop: 10,
      paddingBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    // Emoji grid
    emojiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: 32,
      minHeight: 240,
    },
    emojiBtn: {
      width: '12.5%',
      paddingVertical: 7,
      alignItems: 'center',
    },
    emojiTxt: { fontSize: 26 },

    // Empty recent state
    emptyRecent: {
      paddingVertical: 32,
      alignItems: 'center',
      minHeight: 240,
      justifyContent: 'center',
    },
    emptyRecentTxt: {
      fontSize: 13,
      color: C.textFaint,
    },
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  visible,
  onClose,
  onEmojiSelect,
}) => {
  const { colors } = useTheme();
  const s = React.useMemo(() => makeStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<ActiveTab>(0);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);

  // Reload from shared cache every time picker opens — ensures recents selected
  // in any other picker instance are immediately visible here too.
  useEffect(() => {
    if (!visible) return;
    getRecentEmojis().then((recents) => {
      setRecentEmojis(recents);
      if (recents.length > 0) setActiveTab('recent');
    });
  }, [visible]);

  const saveRecent = useCallback((emoji: string) => {
    const updated = addToRecentCache(emoji);
    setRecentEmojis(updated);
  }, []);

  const handleEmoji = useCallback(
    (emoji: string) => {
      saveRecent(emoji);
      onEmojiSelect(emoji);
      onClose();
    },
    [onEmojiSelect, onClose, saveRecent],
  );

  const activeEmojis: string[] =
    activeTab === 'recent'
      ? recentEmojis
      : (EMOJI_CATEGORIES[activeTab as number]?.emojis ?? []);

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
                  {/* Recent tab — only shown once at least one emoji has been used */}
                  {recentEmojis.length > 0 && (
                    <TouchableOpacity
                      style={[s.tab, activeTab === 'recent' && s.tabActive]}
                      onPress={() => setActiveTab('recent')}
                      accessibilityLabel="Recently used"
                    >
                      <View style={s.tabIconWrap}>
                        <Clock3
                          size={18}
                          color={activeTab === 'recent' ? colors.teal : colors.textMuted}
                        />
                      </View>
                    </TouchableOpacity>
                  )}

                  {EMOJI_CATEGORIES.map((cat, i) => (
                    <TouchableOpacity
                      key={cat.label}
                      style={[s.tab, i === activeTab && s.tabActive]}
                      onPress={() => setActiveTab(i)}
                      accessibilityLabel={cat.label}
                    >
                      <View style={s.tabIconWrap}>
                        <cat.icon
                          size={18}
                          color={i === activeTab ? colors.teal : colors.textMuted}
                        />
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Emoji grid */}
              <ScrollView showsVerticalScrollIndicator={false}>
                {activeTab === 'recent' && recentEmojis.length === 0 ? (
                  <View style={s.emptyRecent}>
                    <Text style={s.emptyRecentTxt}>No recently used emoji yet</Text>
                  </View>
                ) : (
                  <View style={s.emojiGrid}>
                    {activeEmojis.map((e, idx) => (
                      <TouchableOpacity
                        key={`${e}-${idx}`}
                        style={s.emojiBtn}
                        onPress={() => handleEmoji(e)}
                        activeOpacity={0.6}
                      >
                        <Text style={s.emojiTxt}>{e}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
