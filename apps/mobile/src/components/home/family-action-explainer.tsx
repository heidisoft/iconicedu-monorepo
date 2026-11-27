import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowRight, BookOpen, Check, Mail, UserPlus, X } from 'lucide-react-native';
import { SheetContent } from '@iconicedu/ui-native/components/sheet-content';
import { useTheme } from '@/providers/theme-provider';

export type FamilyAction = 'child' | 'class';

/** Presentation only: actual creation/request remains in the existing confirmed flows. */
export function FamilyActionExplainer({
  kind,
  onClose,
  onContinue,
  onInvite,
}: {
  kind: FamilyAction;
  onClose: () => void;
  onContinue: () => void;
  onInvite?: () => void;
}) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(true);
  const pending = useRef<(() => void) | null>(null);
  const leaving = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current = null;
    };
  }, []);
  const child = kind === 'child';
  const title = child ? 'Add a child' : 'Request a class';
  const bg = child ? colors.promotionYellow : colors.promotionMint;
  const fg = child ? colors.promotionYellowForeground : colors.promotionMintForeground;
  const Icon = child ? UserPlus : BookOpen;
  const steps = child
    ? [
        [
          'A profile that grows with them',
          'Add their first and last names, birth year and grade. You can choose a display name too.',
        ],
        [
          'Start with the essentials',
          'Email is optional. Location and time zone start with your profile settings, so there is less to enter.',
        ],
        [
          'Keep learning together',
          'Review and confirm the details before adding them. Then manage their profile and learning from Family.',
        ],
      ]
    : [
        [
          'Choose who and what',
          'Select one or more children and the subjects they need help with. Choose Other to request a different subject.',
        ],
        [
          'Tell us what matters',
          'Add learning goals and any accommodations or preferences to help our team understand your family’s needs.',
        ],
        [
          'Continue the conversation',
          'Submit your request to open a conversation with our team. We will discuss suitable classes and next steps with you.',
        ],
      ];
  function finish() {
    const action = pending.current;
    pending.current = null;
    if (mounted.current) action?.();
  }
  function leave(action: () => void) {
    if (leaving.current) return;
    leaving.current = true;
    pending.current = action;
    setVisible(false);
    // iOS must finish dismissing this native sheet before another sheet is presented.
    if (Platform.OS !== 'ios') finish();
  }
  return (
    <Modal
      visible={visible}
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={() => leave(onClose)}
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
            accessibilityLabel={`Close ${title.toLowerCase()} introduction`}
            onPress={() => leave(onClose)}
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
              fontSize: 17,
              fontWeight: '600',
              color: colors.text,
            }}
          >
            {title}
          </Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 32 }}>
          <View style={{ borderRadius: 28, padding: 28, gap: 12, backgroundColor: bg }}>
            <Icon size={44} color={fg} />
            <Text
              style={{
                color: fg,
                fontSize: 14,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              {child ? 'Room for every learner' : 'Their next learning step'}
            </Text>
            <Text
              accessibilityRole="header"
              style={{ color: fg, fontSize: 38, fontWeight: '800' }}
            >
              {child ? 'Their learning, all together.' : 'Find the right support.'}
            </Text>
            <Text style={{ color: fg, fontSize: 17, lineHeight: 25 }}>
              {child
                ? 'Bring your child’s profile and learning into one family account.'
                : 'Tell us what your child needs. Our team will help you explore the options.'}
            </Text>
          </View>
          <View style={{ gap: 20 }}>
            {steps.map(([heading, detail]) => (
              <View
                key={heading}
                style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    backgroundColor: colors.actionSubtle,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check size={20} color={colors.action} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                    {heading}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 15, lineHeight: 23 }}>
                    {detail}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20 }}>
            {child
              ? 'Want your child to sign in with their own email? You can send an email invitation instead.'
              : 'A request starts a conversation. It does not book a class or take a payment.'}
          </Text>
        </ScrollView>
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: 16,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            gap: 8,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              child ? 'Continue to add child' : 'Continue to class request'
            }
            onPress={() => leave(onContinue)}
            style={{
              minHeight: 52,
              borderRadius: 18,
              backgroundColor: colors.action,
              flexDirection: 'row',
              gap: 10,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 16,
            }}
          >
            <Text
              style={{
                color: colors.actionForeground,
                fontSize: 17,
                fontWeight: '600',
                flexShrink: 1,
                textAlign: 'center',
              }}
            >
              {child ? 'Create child profile' : 'Explore classes'}
            </Text>
            <ArrowRight size={18} color={colors.actionForeground} />
          </Pressable>
          {child && onInvite && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Invite child by email instead"
              onPress={() => leave(onInvite)}
              style={{
                minHeight: 48,
                flexDirection: 'row',
                gap: 8,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Mail size={18} color={colors.action} />
              <Text
                style={{
                  color: colors.action,
                  fontSize: 16,
                  fontWeight: '600',
                  flexShrink: 1,
                }}
              >
                Invite by email instead
              </Text>
            </Pressable>
          )}
        </View>
      </SheetContent>
    </Modal>
  );
}
