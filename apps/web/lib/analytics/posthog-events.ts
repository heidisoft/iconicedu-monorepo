// clientException and webVital were custom events — replaced by PostHog's
// native capture_exceptions ($exception) and capture_performance ($web_vitals).
export const POSTHOG_EVENT_KEYS = {
  appLoaded: 'app_loaded',
  authTelemetry: 'auth_telemetry',
} as const;

export function buildPostHogCurrentUrl(
  pathname: string | null,
  search: string | null | undefined,
  origin?: string | null,
): string | null {
  if (!pathname) {
    return null;
  }

  const normalizedSearch = search ? search.replace(/^\?/, '') : '';
  const pathWithSearch = normalizedSearch ? `${pathname}?${normalizedSearch}` : pathname;

  if (!origin) {
    return pathWithSearch;
  }

  return `${origin.replace(/\/$/, '')}${pathWithSearch}`;
}

export function buildPostHogPageViewProperties(input: {
  pathname: string | null;
  search?: string | null;
  origin?: string | null;
}) {
  const currentUrl = buildPostHogCurrentUrl(input.pathname, input.search, input.origin);

  return {
    $current_url: currentUrl,
    pathname: input.pathname,
    search: input.search ? `?${input.search.replace(/^\?/, '')}` : '',
  };
}

export function buildPostHogIdentifyProperties(input: {
  email?: string | null;
  accountId?: string | null;
  orgId?: string | null;
  orgSlug?: string | null;
}) {
  return {
    ...(input.email ? { email: input.email } : {}),
    ...(input.accountId ? { accountId: input.accountId } : {}),
    ...(input.orgId ? { orgId: input.orgId } : {}),
    ...(input.orgSlug ? { orgSlug: input.orgSlug } : {}),
  };
}
