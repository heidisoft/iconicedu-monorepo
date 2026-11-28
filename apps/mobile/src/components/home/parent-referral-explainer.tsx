import { useMobileFeatureFlag } from '@/hooks/use-mobile-feature-flag';
import { mobileFeatureFlagKeys } from '@/lib/feature-flags';
import { queryKeys } from '@/lib/api/query-keys';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import { Gift, Send, ShieldCheck, Users, X } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { SheetContent } from '@iconicedu/ui-native/components/sheet-content';
import { useTheme } from '@/providers/theme-provider';
import {
  fetchParentReferralOffer,
  prepareParentReferralLink,
} from '@/lib/api/parent-referrals';

export function ParentReferralExplainer({
  onClose,
  orgId,
}: {
  onClose: () => void;
  orgId: string;
}) {
  const { colors } = useTheme();
  const enabled = useMobileFeatureFlag(mobileFeatureFlagKeys.enableParentReferrals);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const [sharing, setSharing] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const offer = useQuery({
    queryKey: queryKeys.parentReferralOffer(),
    enabled,
    queryFn: fetchParentReferralOffer,
    retry: false,
  });
  const icons = [Send, Users, ShieldCheck];
  async function share() {
    if (!enabledRef.current || sharing || !offer.data) return;
    setSharing(true);
    try {
      const invitation = await prepareParentReferralLink(orgId);
      if (!mounted.current || !enabledRef.current) return;
      await Share.share({
        title: 'Join me at ICONIC Academy',
        message: `Join my family at ICONIC Academy. Explore classes for your child and sign up in the app or on the website.${Platform.OS === 'ios' ? '' : `\n${invitation.url}`}`,
        ...(Platform.OS === 'ios' ? { url: invitation.url } : {}),
      });
    } catch {
      if (mounted.current)
        Alert.alert(
          'Unable to share invitation',
          'Please try again. Your invitation will be ready when sharing is available.',
        );
    } finally {
      if (mounted.current) setSharing(false);
    }
  }
  if (!enabled) return null;
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
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
            accessibilityLabel="Close referral explainer"
            onPress={onClose}
            disabled={sharing}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.inputBg,
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
            Refer a parent
          </Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 32 }}>
          <View
            style={{
              borderRadius: 28,
              padding: 28,
              gap: 12,
              backgroundColor: colors.promotionPink,
            }}
          >
            <Gift size={44} color={colors.promotionPinkForeground} />
            <Text
              style={{
                color: colors.promotionPinkForeground,
                fontSize: 14,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              A little thank-you
            </Text>
            <Text
              accessibilityRole="header"
              style={{
                color: colors.promotionPinkForeground,
                fontSize: 38,
                fontWeight: '800',
              }}
            >
              {offer.data?.rewardLabel ?? 'Better together'}
            </Text>
            <Text
              style={{
                color: colors.promotionPinkForeground,
                fontSize: 17,
                lineHeight: 25,
              }}
            >
              Bring another parent into our learning community.
            </Text>
          </View>
          {offer.isPending ? (
            <ActivityIndicator
              accessibilityLabel="Loading referral details"
              color={colors.action}
            />
          ) : offer.isError ? (
            <View style={{ gap: 12 }}>
              <Text accessibilityRole="alert" style={{ color: colors.text }}>
                Referral sharing is unavailable right now. Please try again shortly.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry referral details"
                onPress={() => void offer.refetch()}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={{ color: colors.action }}>Try again</Text>
              </Pressable>
            </View>
          ) : offer.data ? (
            <>
              <Text style={{ color: colors.text, fontSize: 16, lineHeight: 24 }}>
                {offer.data.explanation}
              </Text>
              <View style={{ gap: 20 }}>
                {offer.data.steps.map((step, index) => {
                  const Icon = icons[index] ?? ShieldCheck;
                  return (
                    <View
                      key={step}
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
                        <Icon size={20} color={colors.action} />
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          color: colors.text,
                          fontSize: 15,
                          lineHeight: 23,
                        }}
                      >
                        {step}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20 }}>
                Your profile display name will appear on the invitation. Our team confirms
                referrals and arranges the $20 discount.
              </Text>
            </>
          ) : null}
        </ScrollView>
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: 16,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share parent invitation"
            accessibilityState={{ disabled: !offer.data || sharing }}
            disabled={!offer.data || sharing}
            onPress={() => void share()}
            style={{
              minHeight: 52,
              borderRadius: 18,
              backgroundColor: colors.action,
              opacity: !offer.data || sharing ? 0.5 : 1,
              flexDirection: 'row',
              gap: 10,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {sharing ? (
              <ActivityIndicator color={colors.actionForeground} />
            ) : (
              <Send size={18} color={colors.actionForeground} />
            )}
            <Text
              style={{
                color: colors.actionForeground,
                fontSize: 17,
                fontWeight: '600',
                flexShrink: 1,
                textAlign: 'center',
              }}
            >
              {sharing ? 'Preparing invitation…' : 'Share invitation'}
            </Text>
          </Pressable>
        </View>
      </SheetContent>
    </Modal>
  );
}
