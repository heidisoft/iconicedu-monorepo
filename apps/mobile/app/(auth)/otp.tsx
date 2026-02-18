import React, { useState, useCallback } from 'react';
import { View, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Button,
  Typography,
  NAV_THEME,
} from '@iconicedu/ui-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/auth-provider';

const OTP_LENGTH = 6;

type TextInputWithClassName = React.ComponentProps<typeof TextInput> & { className?: string };
const StyledCodeInput = TextInput as React.ComponentType<TextInputWithClassName>;

export default function OtpScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { verifyOtp, signInWithOtp } = useAuth();
  const router = useRouter();

  const handleVerify = useCallback(async () => {
    if (code.length !== OTP_LENGTH) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: verifyError } = await verifyOtp(email ?? '', code);

    if (verifyError) {
      setError(verifyError);
      setLoading(false);
      return;
    }

    router.replace('/(app)/(tabs)');
  }, [code, email, verifyOtp, router]);

  const handleResend = useCallback(async () => {
    if (!email) return;
    setError(null);
    const { error: resendError } = await signInWithOtp(email);
    if (resendError) {
      setError(resendError);
    }
  }, [email, signInWithOtp]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV_THEME.dark.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View className="flex-1 justify-center px-6 gap-6">
          <View className="items-center gap-2">
            <Typography variant="h2" className="text-center">
              Check your email
            </Typography>
            <Typography variant="muted" className="text-center">
              We sent a verification code to
            </Typography>
            <Typography variant="body-sm" className="text-center text-foreground">
              {email}
            </Typography>
          </View>

          <View className="items-center gap-4">
            <StyledCodeInput
              className="w-full rounded-xl border border-input bg-card px-4 py-4 text-center text-2xl font-bold tracking-[12px] text-foreground"
              value={code}
              onChangeText={(text: string) => {
                const cleaned = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
                setCode(cleaned);
              }}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              autoFocus
              accessibilityLabel="Verification code"
            />

            {error && (
              <Typography variant="body-sm" className="text-destructive">
                {error}
              </Typography>
            )}
          </View>

          <Button
            label="Verify"
            onPress={handleVerify}
            loading={loading}
            size="lg"
            disabled={code.length !== OTP_LENGTH}
          />

          <View className="flex-row items-center justify-center gap-1">
            <Typography variant="muted">Didn't get a code?</Typography>
            <Button
              label="Resend"
              variant="ghost"
              size="sm"
              onPress={handleResend}
            />
          </View>

          <Button
            label="Back to Login"
            variant="ghost"
            onPress={() => router.back()}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
