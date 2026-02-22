import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SiteLogoFull } from '@iconicedu/ui-native';
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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signInWithOtp } = useAuth();
  const router = useRouter();

  const handleLogin = useCallback(async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: signInError } = await signInWithOtp(email.trim());
    if (signInError) {
      setError(signInError);
      setLoading(false);
      return;
    }
    setLoading(false);
    router.push({ pathname: '/(auth)/otp', params: { email: email.trim() } });
  }, [email, signInWithOtp, router]);

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.flex}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <SiteLogoFull height={34} color="#0f172a" />

          {/* Heading */}
          <Text style={s.heading}>{'Sign in or create\nan account'}</Text>

          {/* Subtitle */}
          <Text style={s.sub}>
            Start your learning journey. Enter your email address to continue.
          </Text>

          {/* Email input */}
          <View style={s.field}>
            <Text style={s.label}>Email address</Text>
            <View style={[s.inputRow, error ? s.inputErr : undefined]}>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (error) setError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="you@example.com"
                placeholderTextColor={C.grayLight}
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              {email.length > 0 && (
                <Pressable
                  onPress={() => setEmail('')}
                  hitSlop={12}
                  style={s.clearBtn}
                  accessibilityLabel="Clear email"
                >
                  <Text style={s.clearX}>×</Text>
                </Pressable>
              )}
            </View>
            {error && <Text style={s.errorTxt}>{error}</Text>}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[s.cta, loading ? s.ctaDim : undefined]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={s.ctaTxt}>{loading ? 'Sending…' : 'Continue'}</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.divRow}>
            <View style={s.divLine} />
            <Text style={s.divTxt}>or continue with</Text>
            <View style={s.divLine} />
          </View>

          {/* Google */}
          <TouchableOpacity style={s.social} activeOpacity={0.8} onPress={() => {}}>
            <View style={s.gBadge}>
              <Text style={s.gBadgeTxt}>G</Text>
            </View>
            <Text style={s.socialTxt}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Apple */}
          <TouchableOpacity
            style={[s.social, s.apple]}
            activeOpacity={0.8}
            onPress={() => {}}
          >
            <Text style={s.appleMark}></Text>
            <Text style={[s.socialTxt, s.socialTxtInv]}>Continue with Apple</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Footer pinned at bottom */}
        <Text style={s.terms}>
          {'By continuing you agree to our '}
          <Text style={s.termsLink}>Terms of Service</Text>
          {' and '}
          <Text style={s.termsLink}>Privacy Policy</Text>
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  flex:        { flex: 1 },
  scroll:      { flexGrow: 1, paddingHorizontal: 24, paddingTop: 52, paddingBottom: 8, gap: 20 },

  heading:     { fontSize: 36, fontWeight: '800', color: C.dark, lineHeight: 44, letterSpacing: -0.5 },
  sub:         { fontSize: 15, color: C.gray, lineHeight: 23 },

  field:       { gap: 6 },
  label:       { fontSize: 13, fontWeight: '500', color: C.gray },
  inputRow:    {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.inputBg,
    borderWidth: 1.5, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 14,
  },
  inputErr:    { borderColor: C.red },
  input:       { flex: 1, fontSize: 15, color: C.dark, paddingVertical: 14 },
  clearBtn:    {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.grayLight,
    alignItems: 'center', justifyContent: 'center',
  },
  clearX:      { color: '#ffffff', fontSize: 17, lineHeight: 21, marginTop: -1 },
  errorTxt:    { fontSize: 12, color: C.red, marginTop: 2 },

  cta:         { backgroundColor: C.teal, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaDim:      { opacity: 0.6 },
  ctaTxt:      { color: C.tealFg, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  divRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divLine:     { flex: 1, height: 1, backgroundColor: C.border },
  divTxt:      { fontSize: 13, color: C.grayLight },

  social:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1.5, borderColor: C.border, borderRadius: 14,
    paddingVertical: 14, backgroundColor: '#ffffff',
  },
  gBadge:      {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#4285F4', alignItems: 'center', justifyContent: 'center',
  },
  gBadgeTxt:   { color: '#ffffff', fontSize: 12, fontWeight: '800', lineHeight: 14 },
  apple:       { backgroundColor: C.dark, borderColor: C.dark },
  appleMark:   { color: '#ffffff', fontSize: 17 },
  socialTxt:   { fontSize: 15, fontWeight: '600', color: C.dark },
  socialTxtInv:{ color: '#ffffff' },

  terms:       { paddingHorizontal: 24, paddingBottom: 24, fontSize: 12, color: C.grayLight, textAlign: 'center', lineHeight: 18 },
  termsLink:   { color: C.dark, fontWeight: '700' },
});
