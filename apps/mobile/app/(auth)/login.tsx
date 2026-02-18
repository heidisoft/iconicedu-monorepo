import React, { useState, useCallback } from 'react';
import { View, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  Input,
  Typography,
  Separator,
  NAV_THEME,
} from '@iconicedu/ui-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/auth-provider';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const { signInWithOtp } = useAuth();
  const router = useRouter();

  const handleLogin = useCallback(async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError(null);
    setStatus(null);

    const { error: signInError } = await signInWithOtp(email.trim());

    if (signInError) {
      setError(signInError);
      setLoading(false);
      return;
    }

    setStatus('Check your email for a login code');
    setLoading(false);
    router.push({ pathname: '/(auth)/otp', params: { email: email.trim() } });
  }, [email, signInWithOtp, router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV_THEME.dark.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View className="flex-1 justify-center px-6 gap-6">
          <View className="items-center gap-2">
            <Typography variant="h1" className="text-center">
              IconicEdu
            </Typography>
            <Typography variant="muted" className="text-center">
              Sign in to your account
            </Typography>
          </View>

          <View className="gap-4">
            <Input
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={error ?? undefined}
              editable={!loading}
            />

            {status && (
              <Typography variant="body-sm" className="text-success">
                {status}
              </Typography>
            )}

            <Button
              label="Continue with Email"
              onPress={handleLogin}
              loading={loading}
              size="lg"
            />
          </View>

          <View className="flex-row items-center gap-4">
            <Separator className="flex-1" />
            <Typography variant="caption">or</Typography>
            <Separator className="flex-1" />
          </View>

          <View className="gap-3">
            <Button
              label="Continue with Google"
              variant="outline"
              size="lg"
              onPress={() => {}}
            />
            <Button
              label="Continue with Apple"
              variant="outline"
              size="lg"
              onPress={() => {}}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
