const DEFAULT_APP_URL = 'http://localhost:3000';

export function resolveAppUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!configuredUrl) {
    return DEFAULT_APP_URL;
  }

  try {
    const parsed = new URL(configuredUrl);
    const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

    if (!isProduction && !isLocalHost) {
      return DEFAULT_APP_URL;
    }

    return configuredUrl.replace(/\/$/, '');
  } catch {
    return DEFAULT_APP_URL;
  }
}
