'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { cn } from '@iconicedu/ui-web/lib/utils';
import { SiteLogoFull } from '@iconicedu/ui-web/components/branding/site-logo-full';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@iconicedu/ui-web/ui/field';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@iconicedu/ui-web/ui/input-otp';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { trackAuthTelemetry } from '@iconicedu/web/lib/telemetry/auth-events';

import {
  buildAuthEntryPath,
  getEmailOtpType,
  shouldCreateUserForIntent,
  type AuthIntent,
} from '../shared/code-entry-utils';

const RESEND_COOLDOWN_SECONDS = 30;

function resolveIntent(value: string | null): AuthIntent {
  return value === 'login' ? 'login' : 'get-started';
}

export default function CodeEntryClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const isVerifyingRef = React.useRef(false);

  const email = searchParams.get('email')?.trim() ?? '';
  const orgSlug = searchParams.get('org')?.trim() ?? '';
  const intent = resolveIntent(searchParams.get('intent'));
  const backHref = buildAuthEntryPath(intent, orgSlug || null);
  const callbackParams = React.useMemo(() => {
    const params = new URLSearchParams({ intent });
    if (intent === 'get-started') {
      params.set('source', 'self-signup');
    }

    if (orgSlug) {
      params.set('org', orgSlug);
    }

    return params;
  }, [intent, orgSlug]);

  const [otp, setOtp] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);
  const [resendCooldown, setResendCooldown] = React.useState(RESEND_COOLDOWN_SECONDS);

  React.useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const verifyCode = React.useCallback(
    async (nextOtp: string) => {
      if (!email || nextOtp.length !== 6) {
        setErrorMessage('Enter the 6-digit verification code to continue.');
        return;
      }

      if (isVerifyingRef.current) {
        return;
      }

      isVerifyingRef.current = true;
      setIsVerifying(true);
      setErrorMessage(null);
      setStatusMessage(null);

      const { error } = await supabase.auth.verifyOtp({
        email,
        token: nextOtp,
        type: getEmailOtpType(intent),
      });

      if (error) {
        setErrorMessage(error.message);
        setIsVerifying(false);
        isVerifyingRef.current = false;
        return;
      }

      await trackAuthTelemetry('auth_success', {
        method: 'email-otp-code',
        intent,
        orgSlug: orgSlug || null,
      });
      router.replace(`/auth/callback?${callbackParams.toString()}`);
    },
    [callbackParams, email, intent, orgSlug, router, supabase],
  );

  React.useEffect(() => {
    if (otp.length === 6) {
      void verifyCode(otp);
    }
  }, [otp, verifyCode]);

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email || otp.length !== 6) {
      setErrorMessage('Enter the 6-digit verification code to continue.');
      return;
    }
    await verifyCode(otp);
  };

  const handleResend = async () => {
    if (!email || resendCooldown > 0) {
      return;
    }

    setIsResending(true);
    setErrorMessage(null);
    setStatusMessage(null);

    await trackAuthTelemetry('auth_start_email', {
      intent: orgSlug ? `org-${intent}` : `global-${intent}`,
      orgSlug: orgSlug || null,
      stage: 'resend',
    });

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: shouldCreateUserForIntent(intent),
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setIsResending(false);
      return;
    }

    await trackAuthTelemetry('auth_magiclink_sent', {
      intent: orgSlug ? `org-${intent}` : `global-${intent}`,
      orgSlug: orgSlug || null,
      stage: 'resend',
    });
    setStatusMessage(`We sent a new verification code to ${email}.`);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setIsResending(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleVerify}>
        <FieldGroup>
          <Field>
            <div className="flex flex-col items-center gap-4 text-center">
              <a href="#" className="flex flex-col items-center mb-8">
                <SiteLogoFull className="h-16 w-auto sm:h-18" />
                <span className="sr-only">ICONIC Academy LLC.</span>
              </a>
              <h1 className="text-xl font-bold">Enter verification code</h1>
              <FieldDescription className="text-center">
                Enter the 6-digit code we sent to {email || 'your email address'}.{' '}
                <Link
                  href={backHref}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Use a different email
                </Link>
              </FieldDescription>
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="otp" className="sr-only">
              Verification code
            </FieldLabel>
            <InputOTP
              id="otp"
              value={otp}
              onChange={(value) => {
                setOtp(value);
                if (errorMessage) {
                  setErrorMessage(null);
                }
                if (statusMessage) {
                  setStatusMessage(null);
                }
              }}
              maxLength={6}
              autoComplete="one-time-code"
              required
              containerClassName="justify-center gap-4"
            >
              <InputOTPGroup className="gap-2.5 *:data-[slot=input-otp-slot]:h-16 *:data-[slot=input-otp-slot]:w-12 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border *:data-[slot=input-otp-slot]:text-xl">
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup className="gap-2.5 *:data-[slot=input-otp-slot]:h-16 *:data-[slot=input-otp-slot]:w-12 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border *:data-[slot=input-otp-slot]:text-xl">
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            {errorMessage || statusMessage ? (
              <div
                role={errorMessage ? 'alert' : 'status'}
                aria-live="polite"
                className={cn(
                  'rounded-2xl border px-3 py-2 text-sm font-medium',
                  errorMessage
                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                )}
              >
                {errorMessage ?? statusMessage}
              </div>
            ) : null}
            <FieldDescription className="text-center">
              Didn&apos;t receive the code?{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || isResending}
                className="font-medium text-foreground underline decoration-current underline-offset-4 disabled:pointer-events-none disabled:opacity-60"
              >
                {isResending
                  ? 'Resending...'
                  : resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend code'}
              </button>
            </FieldDescription>
          </Field>
          <Field>
            <Button
              type="submit"
              variant="secondary"
              disabled={isVerifying || otp.length !== 6}
              className="hover:bg-primary/90 hover:text-primary-foreground"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Verifying code...
                </>
              ) : (
                'Verify code'
              )}
            </Button>
          </Field>
          <div className="space-y-1 text-center text-xs text-muted-foreground">
            <p>
              Secure verification. No password required. Continue once your code is
              confirmed.
            </p>
          </div>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a> and{' '}
        <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  );
}
