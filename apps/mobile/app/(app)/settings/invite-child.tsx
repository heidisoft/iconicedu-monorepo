import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/providers/theme-provider';
import { useAuth } from '@/providers/auth-provider';
import { useFamilyView } from '@/providers/family-view-provider';
import { fetchProfileSettings } from '@/lib/api/profile-settings';
import { sendFamilyChildInvite } from '@/lib/api/family-invites';
import {
  ProfileTextInput,
  profileFieldStyles,
} from '@/components/profile/profile-text-input';

export default function InviteChildScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const family = useFamilyView();
  const client = useQueryClient();
  const params = useLocalSearchParams<{ profileId?: string }>();
  const profileId = typeof params.profileId === 'string' ? params.profileId : undefined;
  const target = useQuery({
    queryKey: ['profile-settings', profileId],
    queryFn: () => fetchProfileSettings(profileId!),
    enabled: !!profileId,
  });
  const [email, setEmail] = useState('');
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  useEffect(() => {
    if (!edited && target.data?.childAccount?.email)
      setEmail(target.data.childAccount.email);
  }, [edited, target.data?.childAccount?.email]);
  const canSend =
    !!family.guardianProfileId &&
    (!profileId || (target.data?.canInvite && !target.data.childAccount?.hasAuthAccount));
  async function send(normalizedEmail: string) {
    setBusy(true);
    try {
      await sendFamilyChildInvite({
        invitedEmail: normalizedEmail,
        ...(profileId ? { targetProfileId: profileId } : {}),
      });
      await client.invalidateQueries();
      await family.refresh();
      router.back();
      Alert.alert(
        'Invitation sent',
        'Your child can use the email link to sign in and join your family.',
      );
    } catch (error) {
      Alert.alert(
        'Unable to send invitation',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  function confirm() {
    if (busy || reviewing || !canSend) return;
    const normalized = email.trim().toLowerCase();
    if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      Alert.alert('Check email', 'Enter a valid child email address.');
      return;
    }
    if (normalized === user?.email?.trim().toLowerCase()) {
      Alert.alert('Check email', 'Child email cannot match the parent email.');
      return;
    }
    setReviewing(true);
    Alert.alert(
      'Send child invitation?',
      `Send an invitation to ${normalized}? The invitation is valid for 7 days.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setReviewing(false) },
        {
          text: 'Send invite',
          onPress: () => {
            setReviewing(false);
            void send(normalized);
          },
        },
      ],
      { cancelable: true, onDismiss: () => setReviewing(false) },
    );
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.pageBg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          disabled={busy}
          onPress={() => router.back()}
          style={{ padding: 8 }}
        >
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            marginRight: 40,
            textAlign: 'center',
            fontSize: 19,
            fontWeight: '700',
            color: colors.text,
          }}
        >
          Invite child
        </Text>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, gap: 16 }}
        >
          {profileId && target.isPending ? (
            <Text style={{ color: colors.text }}>Loading child details…</Text>
          ) : profileId && target.isError ? (
            <Pressable onPress={() => void target.refetch()}>
              <Text style={{ color: colors.text }}>
                Unable to load child. Tap to retry.
              </Text>
            </Pressable>
          ) : !canSend ? (
            <Text style={{ color: colors.text }}>
              You cannot send a sign-in invitation for this profile.
            </Text>
          ) : (
            <>
              <Text style={{ color: colors.textMuted }}>
                {profileId
                  ? 'Invite your child to sign in using their existing profile. Their current details will be kept.'
                  : 'Invite your child by email. They will join your family after signing in with the email link.'}
              </Text>
              <View style={{ gap: 8 }}>
                <Text style={profileFieldStyles(colors).label}>Child email</Text>
                <ProfileTextInput
                  accessibilityLabel="Child email"
                  value={email}
                  onChangeText={(value) => {
                    setEdited(true);
                    setEmail(value);
                  }}
                  editable={!busy && !reviewing}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  maxLength={254}
                  placeholder="child@example.com"
                  placeholderTextColor={colors.textFaint}
                  returnKeyType="done"
                />
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={busy || reviewing}
                onPress={confirm}
                style={{
                  backgroundColor: colors.teal,
                  padding: 16,
                  borderRadius: 12,
                  opacity: busy || reviewing ? 0.5 : 1,
                }}
              >
                <Text
                  style={{ color: colors.tealFg, textAlign: 'center', fontWeight: '700' }}
                >
                  {busy ? 'Sending…' : 'Send invite'}
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
