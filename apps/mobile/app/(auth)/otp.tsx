import React, { useState, useCallback } from 'react';
import { KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Button,
  Typography,
  StyledView,
} from '@iconicedu/ui-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/auth-provider';

const OTP_LENGTH = 6;

// Use plain TextInput with type cast for className since StyledTextInput doesn't support ref
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <StyledView className="flex-1 justify-center px-6 gap-6">
          <StyledView className="items-center gap-2">
            <Typography variant="h2" className="text-center">
              Check your email
            </Typography>
            <Typography variant="muted" className="text-center">
              We sent a verification code to
            </Typography>
            <Typography variant="body-sm" className="text-center text-white">
              {email}
            </Typography>
          </StyledView>

          <StyledView className="items-center gap-4">
            <StyledCodeInput
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-4 text-center text-2xl font-bold tracking-[12px] text-white"
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
              <Typography variant="body-sm" className="text-red-400">
                {error}
              </Typography>
            )}
          </StyledView>

          <Button
            label="Verify"
            onPress={handleVerify}
            loading={loading}
            size="lg"
            disabled={code.length !== OTP_LENGTH}
          />

          <StyledView className="flex-row items-center justify-center gap-1">
            <Typography variant="muted">Didn't get a code?</Typography>
            <Button
              label="Resend"
              variant="ghost"
              size="sm"
              onPress={handleResend}
            />
          </StyledView>

          <Button
            label="Back to Login"
            variant="ghost"
            onPress={() => router.back()}
          />
        </StyledView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
