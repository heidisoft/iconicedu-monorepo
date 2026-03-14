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

  return '/get-started';
}

export function getEmailOtpType(intent: AuthIntent): 'email' | 'signup' {
  return intent === 'login' ? 'email' : 'signup';
}

export function shouldCreateUserForIntent(intent: AuthIntent): boolean {
  return intent === 'get-started';
}
