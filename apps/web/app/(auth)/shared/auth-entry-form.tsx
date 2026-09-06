'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@iconicedu/ui-web/ui/field';
import { Input } from '@iconicedu/ui-web/ui/input';
import { SiteLogoFull } from '@iconicedu/ui-web/components/branding/site-logo-full';
import { Loader2 } from 'lucide-react';

type OAuthProvider = 'apple' | 'google';
type OAuthActionVerb = 'login' | 'sign-up';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthEntryFormProps = React.ComponentProps<'div'> & {
  title: string;
  subtitle: string;
  introText: string;
  trustLine: string;
  onEmailLogin?: (email: string) => Promise<void> | void;
  onEmailChange?: (email: string) => void;
  onOAuthLogin?: (provider: OAuthProvider) => Promise<void> | void;
  statusMessage?: string | null;
  errorMessage?: React.ReactNode | null;
  submitLabel?: string;
  submitLoadingLabel?: string;
  oauthActionVerb?: OAuthActionVerb;
  enableGoogleSignIn?: boolean;
  enableAppleSignIn?: boolean;
  featureBullets?: string[];
  footerLinkLabel?: string;
  footerLinkHref?: string;
  footerLinkIntro?: string;
  initialEmail?: string;
};

function GoogleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
        fill="currentColor"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="7 5 12.5 15">
      <path
        d="M17.05 12.58c-.03-2.06 1.68-3.05 1.76-3.1-1-.46-2.04-.52-2.47-.53-1.05-.11-2.06.62-2.59.62-.54 0-1.37-.61-2.25-.59-1.16.02-2.23.67-2.83 1.71-1.21 2.1-.31 5.2.87 6.9.58.83 1.26 1.77 2.17 1.73.87-.03 1.2-.56 2.25-.56 1.05 0 1.35.56 2.27.54.94-.02 1.53-.85 2.1-1.69.66-.96.93-1.89.94-1.94-.02-.01-1.81-.69-1.83-2.74z"
        fill="currentColor"
      />
      <path
        d="M15.65 7.84c.48-.58.8-1.38.71-2.18-.69.03-1.53.46-2.03 1.04-.44.51-.83 1.33-.73 2.11.78.06 1.57-.39 2.05-.97z"
        fill="currentColor"
      />
    </svg>
  );
}

export function getOAuthButtonLabel(
  provider: OAuthProvider,
  isLoading: boolean,
  actionVerb: OAuthActionVerb = 'login',
): string {
  if (!isLoading) {
    if (actionVerb === 'sign-up') {
      return provider === 'google' ? 'Sign up with Google' : 'Sign up with Apple';
    }
    return provider === 'google' ? 'Login with Google' : 'Login with Apple';
  }
  if (actionVerb === 'sign-up') {
    return provider === 'google'
      ? 'Signing you up with Google...'
      : 'Signing you up with Apple...';
  }
  return provider === 'google'
    ? 'Logging you in with Google...'
    : 'Logging you in with Apple...';
}

export function AuthEntryForm({
  className,
  title,
  subtitle,
  introText,
  trustLine,
  onEmailLogin,
  onEmailChange,
  onOAuthLogin,
  statusMessage,
  errorMessage,
  submitLabel = 'Send code',
  submitLoadingLabel = 'Sending secure link...',
  oauthActionVerb = 'login',
  enableGoogleSignIn = true,
  enableAppleSignIn = true,
  featureBullets,
  footerLinkLabel,
  footerLinkHref,
  footerLinkIntro,
  initialEmail = '',
  ...props
}: AuthEntryFormProps) {
  const [email, setEmail] = React.useState(initialEmail);
  const [emailDirty, setEmailDirty] = React.useState(false);
  const [isEmailSubmitting, setIsEmailSubmitting] = React.useState(false);
  const [oauthSubmittingProvider, setOauthSubmittingProvider] =
    React.useState<OAuthProvider | null>(null);

  const trimmedEmail = email.trim();
  const isValidEmail = EMAIL_RE.test(trimmedEmail);
  const showEmailError = emailDirty && trimmedEmail.length > 0 && !isValidEmail;
  const isSubmitting = isEmailSubmitting || oauthSubmittingProvider !== null;
  const isEmailSubmitDisabled = isSubmitting || !isValidEmail;
  const showOAuthOptions = enableGoogleSignIn || enableAppleSignIn;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onEmailLogin) {
      return;
    }
    setEmailDirty(true);
    if (!isValidEmail) {
      return;
    }
    setIsEmailSubmitting(true);
    try {
      await onEmailLogin(trimmedEmail);
    } finally {
      setIsEmailSubmitting(false);
    }
  };

  const handleOAuthLogin = (provider: OAuthProvider) => async () => {
    if (!onOAuthLogin) {
      return;
    }
    setOauthSubmittingProvider(provider);
    try {
      await onOAuthLogin(provider);
    } finally {
      setOauthSubmittingProvider(null);
    }
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <div className="flex flex-col items-center gap-2 text-center">
              <a href="#" className="flex flex-col items-center mb-8">
                <SiteLogoFull className="h-16 w-auto sm:h-18" />
                <span className="sr-only">ICONIC Academy LLC.</span>
              </a>
              <h1 className="text-xl font-bold">{title}</h1>
              <FieldDescription className="text-center">
                {subtitle}
                {footerLinkLabel && footerLinkHref ? (
                  <>
                    {' '}
                    {footerLinkIntro ? <span>{footerLinkIntro} </span> : null}
                    <Link
                      href={footerLinkHref}
                      className="font-medium text-foreground underline underline-offset-4"
                    >
                      {footerLinkLabel}
                    </Link>
                  </>
                ) : null}
              </FieldDescription>
            </div>
          </Field>
          <Field>
            {introText ? (
              <div className="text-center text-sm text-muted-foreground">
                <p>{introText}</p>
              </div>
            ) : null}
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                onEmailChange?.(event.target.value);
              }}
              onBlur={() => {
                if (email.trim()) {
                  setEmailDirty(true);
                }
              }}
            />
            {showEmailError ? (
              <p className="text-sm font-medium text-destructive">
                Please enter a valid email address
              </p>
            ) : null}
            {errorMessage || statusMessage ? (
              <div
                role={errorMessage ? 'alert' : 'status'}
                aria-live="polite"
                className={cn(
                  'rounded-2xl border px-3 py-2 text-sm font-medium',
                  errorMessage
                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                    : 'border-success/30 bg-success/10 text-success',
                )}
              >
                {errorMessage ?? statusMessage}
              </div>
            ) : null}
          </Field>
          <Field>
            <Button
              type="submit"
              variant="secondary"
              disabled={isEmailSubmitDisabled}
              className="hover:bg-primary/90 hover:text-primary-foreground"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {submitLoadingLabel}
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </Field>
          {showOAuthOptions ? (
            <>
              <FieldSeparator className="my-0">OR</FieldSeparator>
              <Field>
                {enableGoogleSignIn ? (
                  <Button
                    type="button"
                    onClick={handleOAuthLogin('google')}
                    variant="default"
                    disabled={isSubmitting}
                  >
                    {oauthSubmittingProvider === 'google' ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <GoogleIcon />
                    )}
                    {getOAuthButtonLabel(
                      'google',
                      oauthSubmittingProvider === 'google',
                      oauthActionVerb,
                    )}
                  </Button>
                ) : null}
                {enableAppleSignIn ? (
                  <Button
                    type="button"
                    onClick={handleOAuthLogin('apple')}
                    variant="default"
                    disabled={isSubmitting}
                  >
                    {oauthSubmittingProvider === 'apple' ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <AppleIcon />
                    )}
                    {getOAuthButtonLabel(
                      'apple',
                      oauthSubmittingProvider === 'apple',
                      oauthActionVerb,
                    )}
                  </Button>
                ) : null}
              </Field>
            </>
          ) : null}
          {featureBullets?.length ? (
            <ul className="space-y-1 text-center text-xs text-muted-foreground">
              {featureBullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : (
            <div className="space-y-1 text-center text-xs text-muted-foreground">
              <p>{trustLine}</p>
            </div>
          )}
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        By continuing, you agree to our <a href="#">Terms</a> and{' '}
        <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  );
}
