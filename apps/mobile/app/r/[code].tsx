import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { X, Users, Check, ArrowRight } from 'lucide-react-native';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import { useMobileFeatureFlag } from '@/hooks/use-mobile-feature-flag';
import { mobileFeatureFlagKeys } from '@/lib/feature-flags';
import { resolveParentReferral } from '@/lib/api/parent-referrals';
import {
  clearPendingParentReferral,
  markParentReferralSignupHandoff,
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
  const focused = useIsFocused();
  const enabled = useMobileFeatureFlag(mobileFeatureFlagKeys.enableParentReferrals);
  const active = useRef(enabled);
  const signedIn = useRef(Boolean(session));
  signedIn.current = Boolean(session);
  const routeCode = useRef(initial);
  routeCode.current = initial;
  const closing = useRef(false);
  active.current = enabled && focused && !closing.current;
  useEffect(() => {
    active.current = enabled && focused && !closing.current;
    return () => {
      active.current = false;
    };
  }, [enabled, focused]);
  useEffect(() => {
    setInput(initial);
    setError(null);
  }, [initial]);
  const code = parseParentReferralCode(input);
  const currentCode = useRef(code);
  currentCode.current = code;
  const invitation = useQuery({
    queryKey: ['parent-referral-invitation', code],
    queryFn: () => resolveParentReferral(code!),
    enabled: enabled && !session && Boolean(code),
    retry: false,
    staleTime: 0,
  });

  async function close() {
    if (closing.current) return;
    closing.current = true;
    active.current = false;
    try {
      await clearPendingParentReferral();
      // A cold deep link can create an implicit OTP history entry without an email.
      // Always close to a usable destination instead of trusting that history.
      router.replace(session ? '/(app)/(tabs)' : '/(auth)/login');
    } catch {
      closing.current = false;
      active.current = enabled && focused;
      Alert.alert(
        'Unable to clear invitation',
        'Please try again before leaving this invitation.',
      );
    }
  }
  async function accept() {
    if (!enabled || session || !code || saving || closing.current) return;
    setSaving(true);
    setError(null);
    try {
      // Revalidate immediately before the parent confirms the invitation.
      await resolveParentReferral(code);
      if (
        !active.current ||
        signedIn.current ||
        routeCode.current !== initial ||
        currentCode.current !== code
      )
        return;
      const saved = await savePendingParentReferral(code, null);
      if (
        !saved ||
        !active.current ||
        signedIn.current ||
        routeCode.current !== initial ||
        currentCode.current !== code
      )
        return;
      markParentReferralSignupHandoff();
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
          onPress={() => {
            void close();
          }}
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
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          padding: 24,
          gap: 24,
          maxWidth: 576,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 64,
            height: 64,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primarySubtle,
          }}
        >
          <Users size={32} color={colors.primary} />
        </View>
        <Text
          style={{
            color: colors.primary,
            fontSize: 13,
            fontWeight: '600',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          A personal invitation
        </Text>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 28,
            lineHeight: 34,
            fontWeight: '700',
            letterSpacing: -0.6,
            color: colors.text,
          }}
        >
          Join families learning with ICONIC Academy.
        </Text>
        {!enabled ? (
          <Text style={{ color: colors.textMuted }}>
            Invitations are currently unavailable. You can still sign up from the welcome
            screen.
          </Text>
        ) : session ? (
          <View style={{ gap: 16 }}>
            <Text
              accessibilityRole="header"
              style={{ fontSize: 20, fontWeight: '600', color: colors.text }}
            >
              Invitations are for new parents
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 16, lineHeight: 24 }}>
              You’re already signed in. A referral cannot be applied to your existing
              account, including your own invitation.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={{ minHeight: 48, justifyContent: 'center' }}
              onPress={() => {
                void close();
              }}
            >
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                Back to your account
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {invitation.data && code ? (
              <Text style={{ color: colors.textMuted, fontSize: 18, lineHeight: 27 }}>
                {invitation.data.referrerName} invited you to ICONIC Academy.
              </Text>
            ) : null}
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
            <View
              style={{
                padding: 24,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                gap: 8,
              }}
            >
              <Text
                accessibilityRole="header"
                style={{
                  fontWeight: '600',
                  fontSize: 16,
                  lineHeight: 22,
                  color: colors.text,
                }}
              >
                Support your child’s next step
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 15, lineHeight: 23 }}>
                Join other parents supporting their children’s learning. Create a parent
                account to explore classes and keep your family’s learning organised in
                one place.
              </Text>
            </View>
            <View style={{ gap: 12 }}>
              {[
                'Explore classes for your child.',
                'Manage your children’s profiles and see their upcoming sessions.',
                'Stay connected with academy updates and messages.',
              ].map((benefit) => (
                <View
                  key={benefit}
                  style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}
                >
                  <View
                    accessible={false}
                    importantForAccessibility="no-hide-descendants"
                    style={{ paddingTop: 2 }}
                  >
                    <Check size={18} color={colors.primary} />
                  </View>
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontSize: 14,
                      lineHeight: 21,
                      flex: 1,
                    }}
                  >
                    {benefit}
                  </Text>
                </View>
              ))}
            </View>
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
              accessibilityHint="Accept your invitation and continue to parent signup."
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
                flexDirection: 'row',
                gap: 12,
                backgroundColor: colors.action,
                opacity: !invitation.data || saving || !code ? 0.5 : 1,
              }}
            >
              {saving ? (
                <ActivityIndicator color={colors.actionForeground} />
              ) : (
                <>
                  <Text
                    style={{
                      color: colors.actionForeground,
                      fontWeight: '600',
                      fontSize: 16,
                      flexShrink: 1,
                    }}
                  >
                    Create your parent account
                  </Text>
                  <ArrowRight size={18} color={colors.actionForeground} />
                </>
              )}
            </Pressable>
            {invitation.data && code ? (
              <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>
                As a thank-you for introducing your family, {invitation.data.referrerName}{' '}
                can receive {invitation.data.rewardLabel} after our team confirms your
                signup. Your invitation is linked automatically, with no referral code to
                enter.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
