import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { X, Users } from 'lucide-react-native';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import { useMobileFeatureFlag } from '@/hooks/use-mobile-feature-flag';
import { mobileFeatureFlagKeys } from '@/lib/feature-flags';
import { resolveParentReferral } from '@/lib/api/parent-referrals';
import { fetchOnboardingStatus } from '@/lib/api/onboarding/queries';
import {
  parseParentReferralCode,
  savePendingParentReferral,
} from '@/lib/referrals/pending-referral';

export default function ParentInvitationScreen() {
  const params = useLocalSearchParams<{ code: string }>();
  const initial =
    typeof params.code === 'string' && params.code !== 'manual' ? params.code : '';
  const [input, setInput] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const enabled = useMobileFeatureFlag(mobileFeatureFlagKeys.enableParentReferrals);
  const active = useRef(enabled);
  active.current = enabled;
  useEffect(() => {
    active.current = enabled;
    return () => {
      active.current = false;
    };
  }, [enabled]);
  useEffect(() => {
    setInput(initial);
    setError(null);
  }, [initial]);
  const code = parseParentReferralCode(input);
  const invitation = useQuery({
    queryKey: ['parent-referral-invitation', code],
    queryFn: () => resolveParentReferral(code!),
    enabled: enabled && Boolean(code),
    retry: false,
    staleTime: 0,
  });

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace(session ? '/(app)/(tabs)' : '/(auth)/login');
  }
  async function accept() {
    if (!enabled || !code || saving) return;
    setSaving(true);
    setError(null);
    try {
      // Revalidate immediately before the parent confirms the invitation.
      await resolveParentReferral(code);
      if (session) {
        try {
          const status = await fetchOnboardingStatus();
          if (status.primaryRole)
            throw new Error(
              'Invitations apply to new parent accounts only. You can continue using your existing account.',
            );
        } catch (failure) {
          if (
            !(failure instanceof Error && failure.message.startsWith('No account found'))
          )
            throw failure;
        }
      }
      if (!active.current) return;
      await savePendingParentReferral(code, session?.user.id ?? null);
      if (!active.current) return;
      router.replace(session ? '/(auth)/profile-setup' : '/(auth)/login');
    } catch (failure) {
      if (active.current)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Unable to save your invitation. Please try again.',
        );
    } finally {
      if (active.current) setSaving(false);
    }
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, alignItems: 'flex-start' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close invitation"
          onPress={close}
          style={{
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 24,
          gap: 20,
          maxWidth: 560,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <Users size={32} color={colors.primary} />
        <Text
          accessibilityRole="header"
          style={{ fontSize: 28, fontWeight: '700', color: colors.text }}
        >
          Join families learning with ICONIC Academy
        </Text>
        {!enabled ? (
          <Text style={{ color: colors.textMuted }}>
            Invitations are currently unavailable. You can still sign up from the welcome
            screen.
          </Text>
        ) : (
          <>
            <Text style={{ color: colors.textMuted, fontSize: 16, lineHeight: 24 }}>
              Explore classes for your child and manage your family’s learning in one
              place.
            </Text>
            {!initial ? (
              <TextInput
                accessibilityLabel="Invitation link or code"
                value={input}
                onChangeText={(value) => {
                  setInput(value);
                  setError(null);
                }}
                maxLength={2048}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!saving}
                placeholder="Paste your invitation link or code"
                placeholderTextColor={colors.textFaint}
                style={{
                  minHeight: 48,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 14,
                  padding: 12,
                  color: colors.text,
                }}
              />
            ) : null}
            {initial && !code ? (
              <>
                <Text accessibilityRole="alert" style={{ color: colors.text }}>
                  This invitation link is not valid.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={{ minHeight: 44, justifyContent: 'center' }}
                  onPress={() => router.replace('/r/manual')}
                >
                  <Text style={{ color: colors.primary }}>Use another invitation</Text>
                </Pressable>
              </>
            ) : null}
            {invitation.isFetching ? (
              <ActivityIndicator
                accessibilityLabel="Checking invitation"
                color={colors.primary}
              />
            ) : null}
            {invitation.data && code ? (
              <View
                style={{
                  padding: 20,
                  borderRadius: 20,
                  backgroundColor: colors.promotionPink,
                  gap: 10,
                }}
              >
                <Text
                  accessibilityRole="header"
                  style={{
                    fontWeight: '700',
                    fontSize: 18,
                    color: colors.promotionPinkForeground,
                  }}
                >
                  Invited by {invitation.data.referrerName}
                </Text>
                <Text style={{ color: colors.promotionPinkForeground, lineHeight: 22 }}>
                  Accept this invitation to link your new parent signup to{' '}
                  {invitation.data.referrerName}. Our team will review their{' '}
                  {invitation.data.rewardLabel} referral reward.
                </Text>
              </View>
            ) : null}
            {error || invitation.isError ? (
              <Text accessibilityRole="alert" style={{ color: colors.text }}>
                {error ??
                  'This invitation could not be checked. Check the link or try again.'}
              </Text>
            ) : null}
            {invitation.isError ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void invitation.refetch();
                }}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={{ color: colors.primary }}>Try again</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !invitation.data || saving || !code }}
              disabled={!invitation.data || saving || !code}
              onPress={() => {
                void accept();
              }}
              style={{
                minHeight: 48,
                padding: 14,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.action,
                opacity: !invitation.data || saving || !code ? 0.5 : 1,
              }}
            >
              {saving ? (
                <ActivityIndicator color={colors.actionForeground} />
              ) : (
                <Text
                  style={{
                    color: colors.actionForeground,
                    fontWeight: '700',
                    fontSize: 16,
                  }}
                >
                  Accept invitation and continue
                </Text>
              )}
            </Pressable>
            <Text style={{ color: colors.textMuted, lineHeight: 20 }}>
              Your invitation will be remembered while you verify your email and set up
              your parent account. Referral rewards apply to new parent accounts only.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
