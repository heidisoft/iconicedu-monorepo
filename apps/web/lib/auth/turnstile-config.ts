export function resolveTurnstileSiteKey(
  enabled: boolean,
  source: Record<string, string | undefined> = process.env,
): string | undefined {
  if (!enabled) return undefined;

  const siteKey = source.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  if (!siteKey) {
    throw new Error(
      'NEXT_PUBLIC_TURNSTILE_SITE_KEY is required when enable-web-turnstile is on.',
    );
  }
  return siteKey;
}
