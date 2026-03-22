const DEFAULT_APP_URL = 'http://localhost:3000';

function normalizeAbsoluteUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const withProtocol =
      trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function resolveAppUrl(): string {
  return (
    normalizeAbsoluteUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeAbsoluteUrl(process.env.VERCEL_BRANCH_URL) ??
    normalizeAbsoluteUrl(process.env.VERCEL_URL) ??
    DEFAULT_APP_URL
  );
}
