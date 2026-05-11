import React, { useState, useCallback, useMemo } from 'react';
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
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Path,
  Line,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Mask,
  Rect,
  G,
} from 'react-native-svg';
import { SiteLogoFull } from '@iconicedu/ui-native';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import { useAnalytics } from '@/providers/analytics-provider';
import { AnalyticsEvent } from '@iconicedu/utils';
import type { AppColors } from '@/lib/theme';

// ─── Decorative background (circles, ring, diamond, grid) ─────────────────────

const GRID_CELL = 56;
const GRID_COLS = 6;
const GRID_ROWS = 6;

function BackgroundDecoration({ isDark }: { isDark: boolean }) {
  const teal1 = 'rgba(45,212,168,0.80)';
  const teal2 = 'rgba(45,212,168,0.50)';
  const teal3 = 'rgba(45,212,168,0.28)';
  const gray1 = isDark ? 'rgba(100,116,139,0.30)' : 'rgba(100,116,139,0.22)';
  const ring = isDark ? 'rgba(45,212,168,0.55)' : 'rgba(45,212,168,0.75)';
  const sq = isDark ? 'rgba(100,116,139,0.20)' : 'rgba(71,85,105,0.16)';
  const grid = isDark ? 'rgba(100,116,139,0.22)' : 'rgba(71,85,105,0.10)';

  const gW = GRID_CELL * GRID_COLS;
  const gH = GRID_CELL * GRID_ROWS;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Grid — top right, fades toward interior */}
      <View style={{ position: 'absolute', top: 0, right: 0 }}>
        <Svg width={gW} height={gH}>
          <Defs>
            {/* White mask: full opacity at top-right corner, fades diagonally to transparent */}
            <SvgLinearGradient id="gridFade" x1="1" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="white" stopOpacity="1" />
              <Stop offset="0.55" stopColor="white" stopOpacity="0.3" />
              <Stop offset="1" stopColor="white" stopOpacity="0" />
            </SvgLinearGradient>
            <Mask id="gridMask">
              <Rect width={gW} height={gH} fill="url(#gridFade)" />
            </Mask>
          </Defs>
          <G mask="url(#gridMask)">
            {Array.from({ length: GRID_COLS + 1 }).map((_, i) => (
              <Line
                key={`v${i}`}
                x1={i * GRID_CELL}
                y1={0}
                x2={i * GRID_CELL}
                y2={gH}
                stroke={grid}
                strokeWidth={1}
              />
            ))}
            {Array.from({ length: GRID_ROWS + 1 }).map((_, i) => (
              <Line
                key={`h${i}`}
                x1={0}
                y1={i * GRID_CELL}
                x2={gW}
                y2={i * GRID_CELL}
                stroke={grid}
                strokeWidth={1}
              />
            ))}
          </G>
        </Svg>
      </View>

      {/* Large ring — top right, overlapping grid */}
      <View
        style={{
          position: 'absolute',
          top: 32,
          right: -18,
          width: 96,
          height: 96,
          borderRadius: 48,
          borderWidth: 20,
          borderColor: ring,
        }}
      />

      {/* Circles cluster — top left, partially off-screen */}
      <View
        style={{
          position: 'absolute',
          top: 52,
          left: -20,
          gap: 8,
          flexDirection: 'row',
          flexWrap: 'wrap',
          width: 116,
        }}
      >
        {(
          [
            { bg: teal1 },
            { bg: teal2 },
            { bg: teal3 },
            { bg: teal2 },
            { bg: gray1 },
            { bg: teal1, bTL: 40, bBR: 40 },
          ] as { bg: string; bTL?: number; bBR?: number }[]
        ).map((c, i) => (
          <View
            key={i}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              borderTopLeftRadius: c.bTL ?? 24,
              borderBottomRightRadius: c.bBR ?? 24,
              backgroundColor: c.bg,
            }}
          />
        ))}
      </View>

      {/* Rotated diamond — bottom right */}
      <View
        style={{
          position: 'absolute',
          bottom: 100,
          right: 28,
          width: 68,
          height: 68,
          transform: [{ rotate: '45deg' }],
          borderWidth: 14,
          borderColor: sq,
        }}
      />

      {/* Small accent circle — bottom left */}
      <View
        style={{
          position: 'absolute',
          bottom: 80,
          left: 24,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: teal3,
        }}
      />
    </View>
  );
}

// ─── Google icon ───────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return {
    placeholderColor: C.textFaint,
    ...StyleSheet.create({
      safe: { flex: 1, backgroundColor: C.bg },
      flex: { flex: 1 },
      scroll: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingBottom: 8,
        gap: 20,
        justifyContent: 'center',
      },

      logo: { alignSelf: 'center', marginBottom: 16 },
      heading: {
        fontSize: 30,
        fontWeight: '700',
        color: C.text,
        lineHeight: 38,
        letterSpacing: 0,
        textAlign: 'center',
      },
      sub: { fontSize: 16, color: C.textMuted, lineHeight: 22, textAlign: 'center' },

      field: { gap: 6 },
      label: { fontSize: 14, fontWeight: '500', color: C.textMuted },
      inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.inputBg,
        borderWidth: 1.5,
        borderColor: C.border,
        borderRadius: 12,
        paddingHorizontal: 14,
      },
      inputErr: { borderColor: C.red },
      input: {
        flex: 1,
        fontSize: 16,
        color: C.text,
        paddingVertical: 14,
        letterSpacing: 0,
      },
      clearBtn: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: C.textFaint,
        alignItems: 'center',
        justifyContent: 'center',
      },
      clearX: { color: '#ffffff', fontSize: 18, lineHeight: 21, marginTop: -1 },
      errorTxt: { fontSize: 13, color: C.red, marginTop: 2 },

      cta: {
        backgroundColor: C.teal,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
      },
      ctaDim: { opacity: 0.6 },
      ctaTxt: { color: C.tealFg, fontSize: 17, fontWeight: '700', letterSpacing: 0 },

      divRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
      divLine: { flex: 1, height: 1, backgroundColor: C.border },
      divTxt: { fontSize: 14, color: C.textFaint },

      social: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        borderWidth: 1.5,
        borderColor: C.border,
        borderRadius: 14,
        paddingVertical: 14,
        backgroundColor: C.card,
      },
      socialTxt: { fontSize: 16, fontWeight: '600', color: C.text },

      noAcct: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 19 },
      noAcctLink: { color: C.teal, fontWeight: '600' },

      terms: {
        paddingHorizontal: 24,
        paddingBottom: 24,
        fontSize: 13,
        color: C.textFaint,
        textAlign: 'center',
        lineHeight: 19,
      },
      termsLink: { color: C.text, fontWeight: '700' },
    }),
  };
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const {
    signInWithOtp,
    signInWithGoogle,
    sessionExpiryMessage,
    clearSessionExpiryMessage,
  } = useAuth();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const analytics = useAnalytics();
  const s = useMemo(() => makeStyles(colors), [colors]);

  React.useEffect(() => {
    analytics.screen('Login', { screen_name: 'login' });
  }, [analytics]);

  const handleLogin = useCallback(async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);
    setError(null);
    clearSessionExpiryMessage();
    analytics.capture(AnalyticsEvent.LOGIN_OTP_REQUESTED, { method: 'email' });
    const { error: signInError } = await signInWithOtp(email.trim());
    if (signInError) {
      analytics.capture(AnalyticsEvent.LOGIN_ERROR, {
        method: 'email',
        error: signInError,
      });
      setError(signInError);
      setLoading(false);
      return;
    }
    setLoading(false);
    router.push({ pathname: '/(auth)/otp', params: { email: email.trim() } });
  }, [analytics, clearSessionExpiryMessage, email, router, signInWithOtp]);

  const handleGoogle = useCallback(async () => {
    setGoogleLoading(true);
    setGoogleError(null);
    clearSessionExpiryMessage();
    analytics.capture(AnalyticsEvent.LOGIN_GOOGLE_STARTED);
    const { error: googleErr } = await signInWithGoogle();
    if (googleErr) {
      analytics.capture(AnalyticsEvent.LOGIN_ERROR, {
        method: 'google',
        error: googleErr,
      });
      setGoogleError(googleErr);
    }
    setGoogleLoading(false);
  }, [analytics, clearSessionExpiryMessage, signInWithGoogle]);

  return (
    <SafeAreaView style={s.safe}>
      <BackgroundDecoration isDark={isDark} />

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
          <View style={s.logo}>
            <SiteLogoFull height={68} color={colors.text} />
          </View>

          {/* Heading */}
          <Text style={s.heading}>Welcome back</Text>

          {/* Subtitle */}
          <Text style={s.sub}>
            Enter your email address to receive a sign-in code.{'\n'}Only registered
            accounts can sign in.
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
                  if (sessionExpiryMessage) clearSessionExpiryMessage();
                  if (error) setError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="you@example.com"
                placeholderTextColor={s.placeholderColor}
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
            {!error && sessionExpiryMessage ? (
              <Text style={s.errorTxt}>{sessionExpiryMessage}</Text>
            ) : null}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[s.cta, loading ? s.ctaDim : undefined]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading && <ActivityIndicator size="small" color={colors.tealFg} />}
            <Text style={s.ctaTxt}>{loading ? 'Sending…' : 'Send code'}</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.divRow}>
            <View style={s.divLine} />
            <Text style={s.divTxt}>or</Text>
            <View style={s.divLine} />
          </View>

          {/* Google */}
          <TouchableOpacity
            style={[s.social, googleLoading ? s.ctaDim : undefined]}
            activeOpacity={0.8}
            onPress={handleGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : (
              <GoogleIcon />
            )}
            <Text style={s.socialTxt}>Continue with Google</Text>
          </TouchableOpacity>
          {googleError && <Text style={s.errorTxt}>{googleError}</Text>}

          {/* No account helper */}
          <Text style={s.noAcct}>
            {"Don't have an account? Visit "}
            <Text
              style={s.noAcctLink}
              onPress={() => Linking.openURL('https://www.iconicedu.com')}
            >
              www.iconicedu.com
            </Text>
            {' to sign up.'}
          </Text>
        </ScrollView>

        {/* Footer */}
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
