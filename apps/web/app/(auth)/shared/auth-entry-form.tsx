'use client';

import * as React from 'react';
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
import { SiteLogo } from '@iconicedu/ui-web/components/branding/site-logo';
import { Loader2 } from 'lucide-react';

type OAuthProvider = 'apple' | 'google';

type AuthEntryFormProps = React.ComponentProps<'div'> & {
  title: string;
  subtitle: string;
  introText: string;
  trustLine: string;
  onEmailLogin?: (email: string) => Promise<void> | void;
  onOAuthLogin?: (provider: OAuthProvider) => Promise<void> | void;
  statusMessage?: string | null;
  errorMessage?: string | null;
  submitLabel?: string;
  submitLoadingLabel?: string;
};

export function getOAuthButtonLabel(
  provider: OAuthProvider,
  isLoading: boolean,
): string {
  if (!isLoading) {
    return provider === 'google' ? 'Continue with Google' : 'Continue with Apple';
  }
  return provider === 'google' ? 'Continuing with Google...' : 'Continuing with Apple...';
}

export function AuthEntryForm({
  className,
  title,
  subtitle,
  introText,
  trustLine,
  onEmailLogin,
  onOAuthLogin,
  statusMessage,
  errorMessage,
  submitLabel = 'Send secure link',
  submitLoadingLabel = 'Sending secure link...',
  ...props
}: AuthEntryFormProps) {
  const [email, setEmail] = React.useState('');
  const [isEmailSubmitting, setIsEmailSubmitting] = React.useState(false);
  const [oauthSubmittingProvider, setOauthSubmittingProvider] =
    React.useState<OAuthProvider | null>(null);

  const isSubmitting = isEmailSubmitting || oauthSubmittingProvider !== null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onEmailLogin) {
      return;
    }
    setIsEmailSubmitting(true);
    try {
      await onEmailLogin(email);
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
          <div className="flex flex-col items-center gap-2 text-center">
            <a href="#" className="flex flex-col items-center gap-2 font-medium">
              <SiteLogo className="size-18 border-0" />
              <span className="sr-only">ICONIC Academy LLC.</span>
            </a>
            <h1 className="text-2xl font-bold">{title}</h1>
            <FieldDescription className="text-center text-xs">{subtitle}</FieldDescription>
          </div>
          <Field>
            <Button
              type="button"
              onClick={handleOAuthLogin('google')}
              variant="default"
              disabled={isSubmitting}
            >
              {oauthSubmittingProvider === 'google' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path
                    d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                    fill="currentColor"
                  />
                </svg>
              )}
              {getOAuthButtonLabel('google', oauthSubmittingProvider === 'google')}
            </Button>
          </Field>
          <FieldSeparator>Or</FieldSeparator>
          <Field>
            <div className="space-y-1 text-center text-xs text-muted-foreground">
              <p>{introText}</p>
            </div>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
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
          </Field>
          <Field>
            <Button
              type="submit"
              variant="secondary"
              disabled={isSubmitting}
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
          <div className="space-y-1 text-center text-xs text-muted-foreground">
            <p>{trustLine}</p>
          </div>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center text-xs">
        By clicking continue, you agree to our <a href="#">Terms of Service</a> and{' '}
        <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  );
}
