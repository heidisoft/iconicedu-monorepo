import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { ArrowRight, BookOpen, Gift, UserPlus, Users, X } from 'lucide-react-native';
import { SheetContent } from '@iconicedu/ui-native/components/sheet-content';
import { useTheme } from '@/providers/theme-provider';

type ActionId = 'refer' | 'child' | 'class';
export function FamilyActionsTile({
  width = 176,
  highlight = 0,
  referralsEnabled = false,
  onAddChild,
  onRefer,
  onRequestClass,
}: {
  width?: number;
  highlight?: number;
  referralsEnabled?: boolean;
  onAddChild: () => void;
  onRefer?: () => void;
  onRequestClass?: () => void;
}) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [presented, setPresented] = useState(false);
  const pending = useRef<ActionId | null>(null);
  const leaving = useRef(false);
  const glow = useRef(new Animated.Value(0)).current;
  const actions = [
    ...(referralsEnabled && onRefer
      ? [
          {
            id: 'refer' as const,
            title: 'Refer a friend',
            description: 'See how your referral discount works.',
            Icon: Gift,
            bg: colors.promotionPink,
            fg: colors.promotionPinkForeground,
            run: onRefer,
          },
        ]
      : []),
    {
      id: 'child' as const,
      title: 'Add a child',
      description: 'Create a profile or invite your child by email.',
      Icon: UserPlus,
      bg: colors.promotionYellow,
      fg: colors.promotionYellowForeground,
      run: onAddChild,
    },
    ...(onRequestClass
      ? [
          {
            id: 'class' as const,
            title: 'Request a class',
            description: 'Explore learning options for your child.',
            Icon: BookOpen,
            bg: colors.promotionMint,
            fg: colors.promotionMintForeground,
            run: onRequestClass,
          },
        ]
      : []),
  ];
  const currentActions = useRef(actions);
  currentActions.current = actions;
  useEffect(
    () => () => {
      pending.current = null;
    },
    [],
  );
  useEffect(() => {
    if (!highlight) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let animation: Animated.CompositeAnimation | undefined;
    void Promise.resolve(AccessibilityInfo.isReduceMotionEnabled())
      .then((reduced) => {
        if (!active) return;
        AccessibilityInfo.announceForAccessibility(
          'You can find this action in More for your family, at the end of Overview.',
        );
        if (reduced) {
          glow.setValue(1);
          timer = setTimeout(() => glow.setValue(0), 1400);
        } else {
          animation = Animated.sequence([
            Animated.timing(glow, { toValue: 1, duration: 180, useNativeDriver: true }),
            Animated.delay(700),
            Animated.timing(glow, { toValue: 0, duration: 500, useNativeDriver: true }),
          ]);
          animation.start();
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      animation?.stop();
      glow.setValue(0);
    };
  }, [glow, highlight]);
  function finish() {
    const id = pending.current;
    pending.current = null;
    setPresented(false);
    if (id) currentActions.current.find((a) => a.id === id)?.run();
  }
  function leave(id: ActionId | null) {
    if (leaving.current) return;
    leaving.current = true;
    pending.current = id;
    setOpen(false);
    if (Platform.OS !== 'ios') finish();
  }
  return (
    <>
      <Pressable
        testID="family-actions-tile"
        accessibilityRole="button"
        accessibilityLabel="More for your family"
        accessibilityHint="Open family actions, including dismissed suggestions"
        onPress={() => {
          leaving.current = false;
          setPresented(true);
          setOpen(true);
        }}
        style={{
          width,
          height: Math.ceil(175 * Math.max(1, fontScale)),
          borderRadius: 20,
          padding: 16,
          gap: 8,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 14,
            backgroundColor: colors.actionSubtle,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Users size={18} color={colors.action} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', gap: 4 }}>
          <Text
            style={{
              color: colors.text,
              fontSize: 15,
              lineHeight: 18,
              fontWeight: '700',
            }}
          >
            More for your family
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 16 }}>
            Always available here.
          </Text>
        </View>
        <View
          style={{ flexDirection: 'row', gap: 6, alignItems: 'center', minHeight: 30 }}
        >
          <Text style={{ color: colors.action, fontSize: 12, fontWeight: '700' }}>
            View actions
          </Text>
          <ArrowRight size={14} color={colors.action} />
        </View>
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            borderRadius: 20,
            borderWidth: 3,
            borderColor: colors.action,
            opacity: glow,
          }}
        />
      </Pressable>
      {presented && (
        <Modal
          visible={open}
          presentationStyle="pageSheet"
          animationType="slide"
          onRequestClose={() => leave(null)}
          onDismiss={finish}
        >
          <SheetContent backgroundColor={colors.pageBg}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingBottom: 12,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close family actions"
                onPress={() => leave(null)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.inputBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={22} color={colors.text} />
              </Pressable>
              <Text
                accessibilityRole="header"
                style={{
                  flex: 1,
                  textAlign: 'center',
                  color: colors.text,
                  fontSize: 17,
                  fontWeight: '600',
                }}
              >
                More for your family
              </Text>
              <View style={{ width: 44 }} />
            </View>
            <ScrollView
              contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 32 }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 16, lineHeight: 24 }}>
                These actions stay here, even after you dismiss their homepage
                suggestions.
              </Text>
              {actions.map((action) => (
                <Pressable
                  key={action.id}
                  accessibilityRole="button"
                  accessibilityLabel={action.title}
                  onPress={() => leave(action.id)}
                  style={{
                    padding: 20,
                    gap: 14,
                    borderRadius: 20,
                    backgroundColor: action.bg,
                    flexDirection: 'row',
                    alignItems: 'center',
                    minHeight: 88,
                  }}
                >
                  <action.Icon size={24} color={action.fg} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={{ color: action.fg, fontSize: 18, fontWeight: '600' }}>
                      {action.title}
                    </Text>
                    <Text style={{ color: action.fg, fontSize: 15, lineHeight: 23 }}>
                      {action.description}
                    </Text>
                  </View>
                  <ArrowRight size={18} color={action.fg} />
                </Pressable>
              ))}
            </ScrollView>
          </SheetContent>
        </Modal>
      )}
    </>
  );
}
