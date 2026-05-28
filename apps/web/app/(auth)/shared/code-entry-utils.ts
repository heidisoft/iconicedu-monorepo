export type AuthIntent = 'login' | 'get-started';

type BuildCodeEntryPathInput = {
  email: string;
  intent: AuthIntent;
  orgSlug?: string | null;
};

export function buildCodeEntryPath({
  email,
  intent,
  orgSlug,
}: BuildCodeEntryPathInput): string {
  const params = new URLSearchParams({
    email,
    intent,
  });

  if (orgSlug) {
    params.set('org', orgSlug);
  }

  return `/code?${params.toString()}`;
}

export function buildAuthEntryPath(intent: AuthIntent, orgSlug?: string | null): string {
  if (orgSlug) {
    return intent === 'login' ? `/${orgSlug}/login` : `/${orgSlug}/get-started`;
  }

  return intent === 'login' ? '/i/login' : '/i/get-started';
}

export function getEmailOtpType(_intent: AuthIntent): 'email' {
  return 'email';
}

export function shouldCreateUserForIntent(intent: AuthIntent): boolean {
  return intent === 'get-started';
}
