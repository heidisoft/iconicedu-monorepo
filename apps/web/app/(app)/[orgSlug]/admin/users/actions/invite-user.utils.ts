export function buildOrgInviteRedirectUrl(input: {
  baseUrl: string;
  profileKind: string;
  orgSlug: string;
  intent?: 'login' | 'get-started';
}): string {
  const sanitizedBase = input.baseUrl.replace(/\/$/, '');
  const params = new URLSearchParams({
    profileKind: input.profileKind,
    org: input.orgSlug,
    intent: input.intent ?? 'login',
  });
  return `${sanitizedBase}/auth/callback?${params.toString()}`;
}

export function ensureOrgCallbackRedirect(
  redirectTo: string,
  orgSlug: string,
  intent: 'login' | 'get-started' = 'login',
): string {
  const trimmed = redirectTo.trim();
  if (!trimmed) {
    return trimmed;
  }

  const isAbsolute = /^https?:\/\//i.test(trimmed);
  const parsed = new URL(trimmed, 'http://localhost');

  if (!parsed.pathname.endsWith('/auth/callback')) {
    return trimmed;
  }

  parsed.searchParams.set('org', orgSlug);
  parsed.searchParams.set('intent', intent);

  if (isAbsolute) {
    return parsed.toString();
  }

  const suffix = parsed.hash ? `${parsed.search}${parsed.hash}` : parsed.search;
  return `${parsed.pathname}${suffix}`;
}
