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
import { ShieldCheck, BellRing, Sparkles } from 'lucide-react-native';
import { SiteLogoFull } from '@iconicedu/ui-native';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import { useAnalytics } from '@/providers/analytics-provider';
import { AnalyticsEvent } from '@iconicedu/utils';
import type { AppColors } from '@/lib/theme';
import { mobileFeatureFlagKeys } from '@/lib/feature-flags';
import { useMobileFeatureFlag } from '@/hooks/use-mobile-feature-flag';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    </View>
  );
}

// ─── Trust row ────────────────────────────────────────────────────────────────

// Copy chosen to address the 3 core parent anxieties:
// 1. "Who are these tutors?" (safety) → background-checked
// 2. "Will I know what's happening?" (control) → real-time updates
// 3. "Will it work for my child?" (outcome) → personalised
const TRUST_PILLARS = [
  { Icon: ShieldCheck, label: 'Qualified, vetted educators' },
  { Icon: BellRing, label: 'Real-time parent updates' },
  { Icon: Sparkles, label: 'Tailored to your child' },
] as const;

function TrustRow({ colors }: { colors: AppColors }) {
  return (
    <View style={{ gap: 8, alignItems: 'center' }}>
      {TRUST_PILLARS.map((p) => (
        <View
          key={p.label}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            width: '100%',
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.teal + '18',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <p.Icon size={18} color={colors.teal} />
          </View>
          <Text
            style={{ fontSize: 14, color: colors.textMuted, fontWeight: '500', flex: 1 }}
          >
            {p.label}
          </Text>
        </View>
      ))}
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

function AppleIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="7 5 12.5 15">
      <Path
        d="M17.05 12.58c-.03-2.06 1.68-3.05 1.76-3.1-1-.46-2.04-.52-2.47-.53-1.05-.11-2.06.62-2.59.62-.54 0-1.37-.61-2.25-.59-1.16.02-2.23.67-2.83 1.71-1.21 2.1-.31 5.2.87 6.9.58.83 1.26 1.77 2.17 1.73.87-.03 1.2-.56 2.25-.56 1.05 0 1.35.56 2.27.54.94-.02 1.53-.85 2.1-1.69.66-.96.93-1.89.94-1.94-.02-.01-1.81-.69-1.83-2.74z"
        fill={color}
      />
      <Path
        d="M15.65 7.84c.48-.58.8-1.38.71-2.18-.69.03-1.53.46-2.03 1.04-.44.51-.83 1.33-.73 2.11.78.06 1.57-.39 2.05-.97z"
        fill={color}
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

      logo: { alignSelf: 'center', marginBottom: 4 },
      heading: {
        fontSize: 28,
        fontWeight: '700',
        color: C.text,
        lineHeight: 36,
        letterSpacing: -0.3,
        textAlign: 'center',
      },
      sub: { fontSize: 15, color: C.textMuted, lineHeight: 22, textAlign: 'center' },
      tabRow: {
        flexDirection: 'row',
        backgroundColor: C.inputBg,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.border,
        padding: 4,
      },
      tab: {
        flex: 1,
        alignItems: 'center',
        borderRadius: 10,
        paddingVertical: 10,
      },
      tabActive: { backgroundColor: C.card },
      tabTxt: { fontSize: 15, fontWeight: '700', color: C.textMuted },
      tabTxtActive: { color: C.text },

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
      appleSocial: { backgroundColor: C.text, borderColor: C.text },
      appleSocialTxt: { color: C.bg },

      terms: {
        paddingHorizontal: 24,
        paddingBottom: 24,
        fontSize: 13,
        color: C.textMuted,
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
  const [emailDirty, setEmailDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [appleError, setAppleError] = useState<string | null>(null);
  const {
    signUpWithOtp,
    signInWithGoogle,
    signInWithApple,
    sessionExpiryMessage,
    clearSessionExpiryMessage,
  } = useAuth();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const analytics = useAnalytics();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const enableGoogleSignIn = useMobileFeatureFlag(
    mobileFeatureFlagKeys.enableMobileGoogleSignIn,
  );
  const enableAppleSignIn = useMobileFeatureFlag(
    mobileFeatureFlagKeys.enableMobileAppleSignIn,
  );
  const showSocialSignIn = enableGoogleSignIn || enableAppleSignIn;

  React.useEffect(() => {
    analytics.screen('Login', { screen_name: 'login' });
  }, [analytics]);

  const handleEmailContinue = useCallback(async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      clearSessionExpiryMessage();
      analytics.capture(AnalyticsEvent.LOGIN_OTP_REQUESTED, { method: 'email' });
      const { error: signInError } = await signUpWithOtp(email.trim());
      if (signInError) {
        analytics.capture(AnalyticsEvent.LOGIN_ERROR, {
          method: 'email',
          error: signInError,
        });
        setError(signInError);
        return;
      }
      router.push({ pathname: '/(auth)/otp', params: { email: email.trim() } });
    } catch (loginError) {
      const message =
        loginError instanceof Error
          ? loginError.message
          : 'Could not send your sign-in code. Please try again.';
      analytics.capture(AnalyticsEvent.LOGIN_ERROR, { method: 'email', error: message });
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [analytics, clearSessionExpiryMessage, email, router, signUpWithOtp]);

  const handleGoogle = useCallback(async () => {
    try {
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
      // Navigation is handled by (auth)/_layout → (app)/_layout → profile-setup if needed
    } catch (googleErr) {
      const message =
        googleErr instanceof Error
          ? googleErr.message
          : 'Could not complete Google sign-in. Please try again.';
      analytics.capture(AnalyticsEvent.LOGIN_ERROR, { method: 'google', error: message });
      setGoogleError(message);
    } finally {
      setGoogleLoading(false);
    }
  }, [analytics, clearSessionExpiryMessage, signInWithGoogle]);

  const handleApple = useCallback(async () => {
    try {
      setAppleLoading(true);
      setAppleError(null);
      clearSessionExpiryMessage();
      analytics.capture(AnalyticsEvent.LOGIN_APPLE_STARTED);
      const { error: appleErr } = await signInWithApple();
      if (appleErr) {
        analytics.capture(AnalyticsEvent.LOGIN_ERROR, {
          method: 'apple',
          error: appleErr,
        });
        setAppleError(appleErr);
      }
      // Navigation is handled by (auth)/_layout → (app)/_layout → profile-setup if needed
    } catch (appleErr) {
      const message =
        appleErr instanceof Error
          ? appleErr.message
          : 'Could not complete Apple sign-in. Please try again.';
      analytics.capture(AnalyticsEvent.LOGIN_ERROR, { method: 'apple', error: message });
      setAppleError(message);
    } finally {
      setAppleLoading(false);
    }
  }, [analytics, clearSessionExpiryMessage, signInWithApple]);

  const socialLoading =
    (enableGoogleSignIn && googleLoading) || (enableAppleSignIn && appleLoading);
  const isValidEmail = EMAIL_RE.test(email.trim());
  const showEmailError = emailDirty && email.trim().length > 0 && !isValidEmail;

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
          <Text style={s.heading}>The tutoring app{'\n'}that keeps you close.</Text>

          {/* Subtitle */}
          <Text style={s.sub}>We&apos;ll send a one-time code. No password needed.</Text>

          {/* Email input */}
          <View style={s.field}>
            <View style={[s.inputRow, error || showEmailError ? s.inputErr : undefined]}>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (sessionExpiryMessage) clearSessionExpiryMessage();
                  if (error) setError(null);
                }}
                onBlur={() => {
                  if (email.trim()) setEmailDirty(true);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="your@email.com"
                placeholderTextColor={s.placeholderColor}
                editable={!loading && !socialLoading}
                returnKeyType="done"
                onSubmitEditing={handleEmailContinue}
              />
              {email.length > 0 && (
                <Pressable
                  onPress={() => {
                    setEmail('');
                    setEmailDirty(false);
                  }}
                  hitSlop={12}
                  style={s.clearBtn}
                  accessibilityLabel="Clear email"
                >
                  <Text style={s.clearX}>×</Text>
                </Pressable>
              )}
            </View>
            {showEmailError && (
              <Text style={s.errorTxt}>Please enter a valid email address</Text>
            )}
            {!showEmailError && error && <Text style={s.errorTxt}>{error}</Text>}
            {!showEmailError && !error && sessionExpiryMessage ? (
              <Text style={s.errorTxt}>{sessionExpiryMessage}</Text>
            ) : null}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[s.cta, !isValidEmail || loading ? s.ctaDim : undefined]}
            onPress={handleEmailContinue}
            disabled={!isValidEmail || loading || socialLoading}
            activeOpacity={0.85}
          >
            {loading && <ActivityIndicator size="small" color={colors.tealFg} />}
            <Text style={s.ctaTxt}>{loading ? 'Sending…' : 'Continue'}</Text>
          </TouchableOpacity>

          {/* Trust signals */}
          <View
            style={{
              backgroundColor: colors.inputBg,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
              gap: 12,
            }}
          >
            <TrustRow colors={colors} />
          </View>

          {showSocialSignIn ? (
            <>
              {/* Divider */}
              <View style={s.divRow}>
                <View style={s.divLine} />
                <Text style={s.divTxt}>or</Text>
                <View style={s.divLine} />
              </View>

              {enableGoogleSignIn ? (
                <>
                  {/* Google */}
                  <TouchableOpacity
                    style={[s.social, googleLoading ? s.ctaDim : undefined]}
                    activeOpacity={0.8}
                    onPress={handleGoogle}
                    disabled={loading || socialLoading}
                  >
                    {googleLoading ? (
                      <ActivityIndicator size="small" color={colors.textMuted} />
                    ) : (
                      <GoogleIcon />
                    )}
                    <Text style={s.socialTxt}>Continue with Google</Text>
                  </TouchableOpacity>
                  {googleError && <Text style={s.errorTxt}>{googleError}</Text>}
                </>
              ) : null}

              {enableAppleSignIn ? (
                <>
                  {/* Apple */}
                  <TouchableOpacity
                    style={[s.social, s.appleSocial, appleLoading ? s.ctaDim : undefined]}
                    activeOpacity={0.8}
                    onPress={handleApple}
                    disabled={loading || socialLoading}
                  >
                    {appleLoading ? (
                      <ActivityIndicator size="small" color={colors.bg} />
                    ) : (
                      <AppleIcon color={colors.bg} />
                    )}
                    <Text style={[s.socialTxt, s.appleSocialTxt]}>
                      Continue with Apple
                    </Text>
                  </TouchableOpacity>
                  {appleError && <Text style={s.errorTxt}>{appleError}</Text>}
                </>
              ) : null}
            </>
          ) : null}
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
