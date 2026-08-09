import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ImageStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SiteLogoFull } from '@iconicedu/ui-native';
import { AnalyticsEvent } from '@iconicedu/utils';
import welcomeImage from '../../assets/auth/tutoring-welcome.png';
import type { AppColors } from '@/lib/theme';
import { useAnalytics } from '@/providers/analytics-provider';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import { TurnstileWidget } from '@/components/auth/turnstile-widget';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim();
const TURNSTILE_BASE_URL =
  process.env.EXPO_PUBLIC_TURNSTILE_BASE_URL?.trim() ||
  process.env.EXPO_PUBLIC_WEB_URL?.trim() ||
  'https://localhost';

function makeStyles(
  C: AppColors,
  layout: {
    imageHeight: `${number}%`;
    imageTranslateY: number;
    panelMaxWidth?: number;
  },
) {
  return {
    placeholderColor: C.textFaint,
    ...StyleSheet.create({
      safe: { flex: 1, backgroundColor: C.card },
      flex: { flex: 1 },
      image: { flex: 1, justifyContent: 'flex-end', overflow: 'hidden' },
      imageStyle: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        resizeMode: 'cover',
        height: layout.imageHeight,
        transform: [{ translateY: layout.imageTranslateY }],
      },
      scrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15,23,42,0.14)',
      },
      panel: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        width: '100%',
        maxWidth: layout.panelMaxWidth,
        alignSelf: 'center',
        backgroundColor: C.card,
        paddingHorizontal: 28,
        paddingTop: 34,
        paddingBottom: 26,
        gap: 20,
        shadowColor: '#000000',
        shadowOpacity: 0.12,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: -8 },
        elevation: 8,
      },
      logo: { alignSelf: 'center', marginBottom: 2 },
      copy: { gap: 10, alignItems: 'center' },
      heading: {
        color: C.text,
        fontSize: 28,
        fontWeight: '800',
        lineHeight: 34,
        letterSpacing: 0,
        textAlign: 'center',
      },
      sub: {
        color: C.textMuted,
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
      },
      field: { gap: 8 },
      inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 54,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: C.border,
        backgroundColor: C.inputBg,
        paddingHorizontal: 16,
      },
      inputErr: { borderColor: C.red },
      input: {
        flex: 1,
        color: C.text,
        fontSize: 16,
        letterSpacing: 0,
        paddingVertical: Platform.OS === 'ios' ? 15 : 12,
      },
      clearBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.textFaint,
      },
      clearX: { color: '#ffffff', fontSize: 18, lineHeight: 21, marginTop: -1 },
      errorTxt: { color: C.red, fontSize: 13, lineHeight: 18 },
      cta: {
        minHeight: 58,
        borderRadius: 29,
        marginTop: 8,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        backgroundColor: C.teal,
      },
      ctaDim: { opacity: 0.6 },
      ctaTxt: {
        color: C.tealFg,
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0,
      },
      terms: {
        color: C.textMuted,
        fontSize: 12,
        lineHeight: 17,
        textAlign: 'center',
      },
      termsLink: { color: C.text, fontWeight: '700' },
    }),
  };
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [emailDirty, setEmailDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const { signUpWithOtp, sessionExpiryMessage, clearSessionExpiryMessage } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const analytics = useAnalytics();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTablet = Math.min(width, height) >= 768;
  const landscapeImageStyle = useMemo<ImageStyle | undefined>(() => {
    if (!isLandscape) return undefined;

    const source = Image.resolveAssetSource(welcomeImage);
    const sourceAspectRatio = source.width / source.height;
    const screenAspectRatio = width / height;
    const renderedWidth =
      screenAspectRatio > sourceAspectRatio ? width : height * sourceAspectRatio;
    const renderedHeight =
      screenAspectRatio > sourceAspectRatio ? width / sourceAspectRatio : height;
    const centeredTop = (height - renderedHeight) / 2;
    const top = Math.min(0, centeredTop + height * 0.28);

    return {
      width: renderedWidth,
      height: renderedHeight,
      left: (width - renderedWidth) / 2,
      top,
      transform: [],
    };
  }, [height, isLandscape, width]);
  const s = useMemo(
    () =>
      makeStyles(colors, {
        imageHeight: isLandscape ? '100%' : isTablet ? '100%' : '108%',
        imageTranslateY: isLandscape || isTablet ? 0 : -18,
        panelMaxWidth: isLandscape && isTablet ? 640 : undefined,
      }),
    [colors, isLandscape, isTablet],
  );

  React.useEffect(() => {
    analytics.screen('Login', { screen_name: 'login' });
  }, [analytics]);

  const handleEmailContinue = useCallback(async () => {
    if (!email.trim()) {
      setEmailDirty(true);
      setError('Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      clearSessionExpiryMessage();
      analytics.capture(AnalyticsEvent.LOGIN_OTP_REQUESTED, { method: 'email' });
      const { error: signInError } = await signUpWithOtp(
        email.trim(),
        captchaToken ?? undefined,
      );

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
      if (TURNSTILE_SITE_KEY) setCaptchaResetKey((key) => key + 1);
    }
  }, [analytics, captchaToken, clearSessionExpiryMessage, email, router, signUpWithOtp]);

  const isValidEmail = EMAIL_RE.test(email.trim());
  const showEmailError = emailDirty && email.trim().length > 0 && !isValidEmail;
  const isDisabled =
    !isValidEmail || loading || Boolean(TURNSTILE_SITE_KEY && !captchaToken);

  return (
    <View style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.flex}
      >
        <View style={s.image}>
          <Image
            source={welcomeImage}
            style={[s.imageStyle, landscapeImageStyle]}
            resizeMode="cover"
          />
          <View style={s.scrim} />
          <View style={s.panel}>
            <View style={s.logo}>
              <SiteLogoFull height={44} color={colors.text} />
            </View>

            <View style={s.copy}>
              <Text style={s.heading}>Personalized tutoring for every child</Text>
              <Text style={s.sub}>
                Book trusted 1-on-1 academic support that helps students build skills,
                confidence, and future readiness.
              </Text>
            </View>

            <View style={s.field}>
              <View
                style={[s.inputRow, error || showEmailError ? s.inputErr : undefined]}
              >
                <TextInput
                  style={s.input}
                  value={email}
                  onChangeText={(nextEmail) => {
                    setEmail(nextEmail);
                    if (sessionExpiryMessage) clearSessionExpiryMessage();
                    if (error) setError(null);
                  }}
                  onBlur={() => {
                    if (email.trim()) setEmailDirty(true);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  placeholder="Email"
                  placeholderTextColor={s.placeholderColor}
                  editable={!loading}
                  returnKeyType="done"
                  onSubmitEditing={handleEmailContinue}
                />
                {email.length > 0 ? (
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
                ) : null}
              </View>
              {showEmailError ? (
                <Text style={s.errorTxt}>Please enter a valid email address</Text>
              ) : null}
              {!showEmailError && error ? <Text style={s.errorTxt}>{error}</Text> : null}
              {!showEmailError && !error && sessionExpiryMessage ? (
                <Text style={s.errorTxt}>{sessionExpiryMessage}</Text>
              ) : null}
            </View>

            {TURNSTILE_SITE_KEY ? (
              <TurnstileWidget
                siteKey={TURNSTILE_SITE_KEY}
                baseUrl={TURNSTILE_BASE_URL}
                onTokenChange={setCaptchaToken}
                resetKey={captchaResetKey}
              />
            ) : null}

            <TouchableOpacity
              style={[s.cta, isDisabled ? s.ctaDim : undefined]}
              onPress={handleEmailContinue}
              disabled={isDisabled}
              activeOpacity={0.86}
            >
              {loading ? <ActivityIndicator size="small" color={colors.tealFg} /> : null}
              <Text style={s.ctaTxt}>{loading ? 'Sending...' : 'Get Started'}</Text>
            </TouchableOpacity>

            <Text style={s.terms}>
              {'By continuing, you agree to our '}
              <Text style={s.termsLink}>Terms</Text>
              {' and '}
              <Text style={s.termsLink}>Privacy Policy</Text>
              {'.'}
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
