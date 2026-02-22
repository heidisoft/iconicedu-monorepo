import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/auth-provider';

const C = {
  bg: '#ffffff',
  teal: '#2dd4a8',
  tealFg: '#042f2e',
  dark: '#0f172a',
  gray: '#64748b',
  grayLight: '#94a3b8',
  border: '#e2e8f0',
  inputBg: '#f8fafc',
  red: '#ef4444',
} as const;

const OTP_LENGTH = 6;

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
    if (resendError) setError(resendError);
  }, [email, signInWithOtp]);

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.flex}
      >
        <View style={s.content}>
          {/* Back */}
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.back}>
            <Text style={s.backTxt}>← Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <Text style={s.heading}>Check your{'\n'}email</Text>
          <Text style={s.sub}>
            {'We sent a 6-digit code to\n'}
            <Text style={s.email}>{email}</Text>
          </Text>

          {/* Code input */}
          <View style={s.field}>
            <Text style={s.label}>Verification code</Text>
            <TextInput
              style={[s.codeInput, error ? s.codeInputErr : undefined]}
              value={code}
              onChangeText={(text) => {
                const cleaned = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
                setCode(cleaned);
                if (error) setError(null);
              }}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              autoFocus
              placeholder="000000"
              placeholderTextColor={C.grayLight}
              accessibilityLabel="Verification code"
            />
            {error && <Text style={s.errorTxt}>{error}</Text>}
          </View>

          {/* Verify CTA */}
          <TouchableOpacity
            style={[s.cta, (loading || code.length !== OTP_LENGTH) ? s.ctaDim : undefined]}
            onPress={handleVerify}
            disabled={loading || code.length !== OTP_LENGTH}
            activeOpacity={0.85}
          >
            <Text style={s.ctaTxt}>{loading ? 'Verifying…' : 'Verify code'}</Text>
          </TouchableOpacity>

          {/* Resend */}
          <View style={s.resendRow}>
            <Text style={s.resendHint}>Didn't get a code? </Text>
            <TouchableOpacity onPress={handleResend} hitSlop={8}>
              <Text style={s.resendLink}>Resend</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  flex:        { flex: 1 },
  content:     { flex: 1, paddingHorizontal: 24, paddingTop: 24, gap: 20 },

  back:        { alignSelf: 'flex-start', marginBottom: 8 },
  backTxt:     { fontSize: 15, fontWeight: '600', color: C.gray },

  heading:     { fontSize: 36, fontWeight: '800', color: C.dark, lineHeight: 44, letterSpacing: -0.5 },
  sub:         { fontSize: 15, color: C.gray, lineHeight: 23 },
  email:       { color: C.dark, fontWeight: '600' },

  field:       { gap: 6 },
  label:       { fontSize: 13, fontWeight: '500', color: C.gray },
  codeInput:   {
    backgroundColor: C.inputBg,
    borderWidth: 1.5, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16,
    fontSize: 28, fontWeight: '700', color: C.dark,
    letterSpacing: 14, textAlign: 'center',
  },
  codeInputErr:{ borderColor: C.red },
  errorTxt:    { fontSize: 12, color: C.red, marginTop: 2 },

  cta:         { backgroundColor: C.teal, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaDim:      { opacity: 0.45 },
  ctaTxt:      { color: C.tealFg, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  resendRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  resendHint:  { fontSize: 14, color: C.grayLight },
  resendLink:  { fontSize: 14, fontWeight: '700', color: C.dark },
});
