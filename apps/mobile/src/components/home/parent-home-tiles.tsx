import React, { useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  ArrowRight,
  ChevronDown,
  Gift,
  UserPlus,
  BookOpen,
  X,
} from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import { useHomeTileDismissal } from '@/hooks/use-home-tile-dismissal';
import { useHomeCarouselIntro } from '@/hooks/use-home-carousel-intro';

type Props = {
  orgId: string;
  accountId: string;
  width?: number;
  referralsEnabled?: boolean;
  autoAdvanceEnabled?: boolean;
  onAddChild: () => void;
  onRefer?: () => void;
  onRequestClass?: () => void;
};

function PromotionCarousel({
  scope,
  width = 176,
  onAddChild,
  onRefer,
  onRequestClass,
  autoAdvanceEnabled = true,
}: Omit<Props, 'orgId' | 'accountId' | 'referralsEnabled'> & { scope: string }) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const height = Math.ceil(175 * Math.max(1, fontScale));
  const { visible, dismiss, saving } = useHomeTileDismissal(scope, 'family-promotions');
  const [active, setActive] = useState(0);
  const pager = useRef<ScrollView>(null);
  const [laidOut, setLaidOut] = useState(false);
  const promotions = [
    ...(onRefer
      ? [
          {
            id: 'refer',
            background: colors.promotionPink,
            foreground: colors.promotionPinkForeground,
            title: 'Refer a friend',
            action: 'How it works',
            description: 'Get $20 off when another parent joins.',
            hint: 'See how your $20 referral discount works before sharing.',
            onPress: onRefer,
            Icon: Gift,
          },
        ]
      : []),
    {
      id: 'child',
      background: colors.promotionYellow,
      foreground: colors.promotionYellowForeground,
      title: 'Add a child',
      description: 'Their learning, all in one place.',
      action: 'Add a child',
      hint: 'Create a child profile in your family account.',
      onPress: onAddChild,
      Icon: UserPlus,
    },
    ...(onRequestClass
      ? [
          {
            id: 'class',
            background: colors.promotionMint,
            foreground: colors.promotionMintForeground,
            title: 'Request a class',
            description: 'Find the right tutor for your child.',
            action: 'Request a class',
            hint: 'Choose a child and subjects using Explore Classes.',
            onPress: onRequestClass,
            Icon: BookOpen,
          },
        ]
      : []),
  ];
  const current = Math.min(active, promotions.length - 1);
  const selected = promotions[current]!;
  function move(index: number) {
    const next = Math.max(0, Math.min(promotions.length - 1, index));
    setActive(next);
    pager.current?.scrollTo({ y: next * height, animated: true });
  }
  const stopIntro = useHomeCarouselIntro(
    scope,
    visible && laidOut && autoAdvanceEnabled && promotions.length > 1,
    () => move(1),
  );
  if (!visible) return null;
  return (
    <View
      testID="parent-promotion-tile"
      onTouchStart={stopIntro}
      style={{
        width,
        height,
        borderRadius: 20,
        backgroundColor: selected.background,
        overflow: 'hidden',
      }}
    >
      <ScrollView
        ref={pager}
        testID="parent-promotion-carousel"
        pagingEnabled
        nestedScrollEnabled
        directionalLockEnabled
        showsVerticalScrollIndicator={false}
        bounces={false}
        style={{ height }}
        onLayout={() => {
          pager.current?.scrollTo({ y: current * height, animated: false });
          setLaidOut(true);
        }}
        onMomentumScrollEnd={(event) =>
          setActive(
            Math.max(
              0,
              Math.min(
                promotions.length - 1,
                Math.round(event.nativeEvent.contentOffset.y / height),
              ),
            ),
          )
        }
        accessibilityLabel="Family suggestions"
        accessibilityRole="adjustable"
        accessibilityValue={{
          min: 1,
          max: promotions.length,
          now: current + 1,
          text: `${current + 1} of ${promotions.length}`,
        }}
        accessibilityActions={[
          { name: 'increment', label: 'Next suggestion' },
          { name: 'decrement', label: 'Previous suggestion' },
        ]}
        onAccessibilityAction={(event) => {
          stopIntro();
          move(current + (event.nativeEvent.actionName === 'increment' ? 1 : -1));
        }}
      >
        {promotions.map((promotion, index) => (
          <View
            key={promotion.id}
            accessibilityElementsHidden={current !== index}
            importantForAccessibility={current === index ? 'auto' : 'no-hide-descendants'}
            style={{
              height,
              padding: 16,
              gap: 6,
              backgroundColor: promotion.background,
            }}
          >
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                width: 36,
                height: 36,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  width: 36,
                  height: 36,
                  borderRadius: 14,
                  backgroundColor: promotion.foreground,
                  opacity: 0.08,
                }}
              />
              <promotion.Icon size={18} strokeWidth={2} color={promotion.foreground} />
            </View>
            <View style={{ flex: 1, justifyContent: 'center', gap: 4 }}>
              <Text
                accessibilityRole="header"
                style={{
                  color: promotion.foreground,
                  fontSize: 15,
                  lineHeight: 18,
                  fontWeight: '700',
                }}
              >
                {promotion.title}
              </Text>
              <Text style={{ color: promotion.foreground, fontSize: 12, lineHeight: 16 }}>
                {promotion.description}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={promotion.action}
              accessibilityHint={promotion.hint}
              onPress={() => {
                stopIntro();
                promotion.onPress();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              style={{
                minHeight: 30,
                paddingHorizontal: 8,
                paddingVertical: 7,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: promotion.foreground,
                backgroundColor: promotion.foreground,
                flexShrink: 0,
                alignSelf: 'flex-start',
                justifyContent: 'center',
                marginRight: promotions.length > 1 ? 20 : 0,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Text
                style={{
                  color: promotion.background,
                  fontSize: 12,
                  flexShrink: 1,
                  fontWeight: '700',
                }}
              >
                {promotion.id === 'child'
                  ? 'Add child'
                  : promotion.id === 'class'
                    ? 'Request class'
                    : promotion.action}
              </Text>
              <ArrowRight size={12} color={promotion.background} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss family suggestions"
        accessibilityState={{ disabled: saving }}
        disabled={saving}
        onPress={() => {
          stopIntro();
          void dismiss().catch(() =>
            Alert.alert('Unable to dismiss', 'Please try again.'),
          );
        }}
        style={{
          position: 'absolute',
          right: 8,
          top: 8,
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={18} color={selected.foreground} />
      </Pressable>
      {promotions.length > 1 && (
        <>
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ position: 'absolute', right: 15, top: height / 2 - 8, gap: 5 }}
          >
            {promotions.map((promotion, index) => (
              <View
                key={promotion.id}
                style={{
                  width: 4,
                  height: index === current ? 10 : 4,
                  borderRadius: 2,
                  backgroundColor: selected.foreground,
                  opacity: index === current ? 1 : 0.3,
                }}
              />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next family suggestion"
            onPress={() => {
              stopIntro();
              move((current + 1) % promotions.length);
            }}
            style={{
              position: 'absolute',
              right: 4,
              bottom: 12,
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChevronDown size={20} color={selected.foreground} />
          </Pressable>
        </>
      )}
    </View>
  );
}

export function ParentHomeTiles({
  orgId,
  accountId,
  referralsEnabled = false,
  onRequestClass,
  onRefer,
  ...props
}: Props) {
  const scope = `${encodeURIComponent(orgId)}:${encodeURIComponent(accountId)}`;
  if (!orgId || !accountId) return null;
  const referralAction = referralsEnabled ? onRefer : undefined;
  return (
    <PromotionCarousel
      key={`${scope}:${referralAction ? 'referrals' : 'child'}:${onRequestClass ? 'classes' : 'none'}`}
      scope={scope}
      onRefer={referralAction}
      onRequestClass={onRequestClass}
      {...props}
    />
  );
}
