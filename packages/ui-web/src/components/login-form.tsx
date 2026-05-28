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

type LoginFormProps = React.ComponentProps<'div'> & {
  onEmailLogin?: (email: string) => Promise<void> | void;
  onOAuthLogin?: (provider: OAuthProvider) => Promise<void> | void;
  statusMessage?: string | null;
  errorMessage?: string | null;
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

export function LoginForm({
  className,
  onEmailLogin,
  onOAuthLogin,
  statusMessage,
  errorMessage,
  ...props
}: LoginFormProps) {
  const [email, setEmail] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onEmailLogin) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onEmailLogin(email);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuthLogin = (provider: OAuthProvider) => async () => {
    if (!onOAuthLogin) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onOAuthLogin(provider);
    } finally {
      setIsSubmitting(false);
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
            <h1 className="text-2xl font-bold">Welcome to ICONIC Academy</h1>
            <FieldDescription className="text-center text-xs">
              Sign in or get started in seconds. We&apos;ll create your secure account
              automatically if you&apos;re new.
            </FieldDescription>
          </div>
          <Field>
            <Button type="button" onClick={handleOAuthLogin('google')} variant="default">
              <GoogleIcon />
              Continue with Google
            </Button>
            <Button type="button" onClick={handleOAuthLogin('apple')} variant="default">
              <AppleIcon />
              Continue with Apple
            </Button>
          </Field>
          <FieldSeparator>Or</FieldSeparator>
          <Field>
            <div className="space-y-1 text-center text-xs text-muted-foreground">
              <p className="">
                We’ll send a one-time secure link to your email. For the best experience,
                open it from the same device where you started.
              </p>
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
                  Sending secure link...
                </>
              ) : (
                'Send secure link'
              )}
            </Button>
          </Field>
          <div className="space-y-1 text-center text-xs text-muted-foreground">
            <p>Secure login. No password required. Flexible access.</p>
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
