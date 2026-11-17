export function isExternalJoinHref(joinHref?: string | null): boolean {
  return Boolean(joinHref && /^https?:\/\//i.test(joinHref));
}

const KNOWN_PROVIDER_LABELS: Record<string, string> = {
  zoom: 'Zoom',
  daily: 'Daily',
  jitsi: 'Jitsi',
};

export function resolveExternalJoinProviderLabel(
  joinHref?: string | null,
  providerHint?: string | null,
) {
  if (!joinHref || !isExternalJoinHref(joinHref)) {
    return null;
  }

  // Our own providers (e.g. Zoom's join_path points at our own domain, not
  // Zoom's) can't be identified by hostname — prefer the provider the join
  // API already told us about, when we have one.
  if (providerHint && KNOWN_PROVIDER_LABELS[providerHint]) {
    return KNOWN_PROVIDER_LABELS[providerHint];
  }

  try {
    const hostname = new URL(joinHref).hostname.toLowerCase();
    if (hostname.includes('zoom')) return 'Zoom';
    if (hostname.includes('jitsi')) return 'Jitsi';
    if (hostname.includes('meet.google')) return 'Google Meet';
    if (hostname.includes('teams.microsoft')) return 'Microsoft Teams';
  } catch {
    return null;
  }

  return null;
}

/**
 * The join API returns web-relative paths (e.g. `/acme/live-sessions/<id>`)
 * for Daily/Zoom/Jitsi sessions, since that's the shared contract web also
 * consumes directly. Resolve these against the web origin before choosing
 * native classroom entry or the provider/browser route.
 */
export function resolveJoinHrefForMobile(joinHref: string): string {
  if (isExternalJoinHref(joinHref)) {
    return joinHref;
  }

  const webBaseUrl = process.env.EXPO_PUBLIC_WEB_URL?.trim() || 'http://localhost:3000';

  try {
    return new URL(joinHref, webBaseUrl).toString();
  } catch {
    return joinHref;
  }
}

/** Owned classroom URLs share one entry path across buttons, message links and OS links. */
export function getAppLiveSessionIdentifier(href: string): string | undefined {
  try {
    const url = new URL(resolveJoinHrefForMobile(href));
    const base = new URL(resolveJoinHrefForMobile('/'));
    return url.origin === base.origin
      ? /^\/live\/([a-zA-Z0-9-]{1,128})\/?$/.exec(url.pathname)?.[1]
      : undefined;
  } catch {
    return undefined;
  }
}
