// Single source of truth for PostHog configuration across the web app.
// Browser and server sections resolve different env vars but share the same
// default host so there is no risk of them drifting apart.

const POSTHOG_DEFAULT_HOST = 'https://us.i.posthog.com';

// ─── Browser (client-side) ────────────────────────────────────────────────────
// Only NEXT_PUBLIC_ vars are inlined by Next.js into the browser bundle.

type BrowserEnv = Partial<
  Record<'NEXT_PUBLIC_POSTHOG_KEY' | 'NEXT_PUBLIC_POSTHOG_HOST', string>
>;

export type PostHogBrowserConfig = {
  apiKey: string;
  /** The real PostHog host — used as ui_host while api_host proxies via /ingest. */
  apiHost: string;
  defaults: '2026-01-30';
};

export function resolvePostHogBrowserConfig(
  env: BrowserEnv = process.env,
): PostHogBrowserConfig | null {
  const apiKey = env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || '';
  if (!apiKey) return null;

  return {
    apiKey,
    apiHost: env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || POSTHOG_DEFAULT_HOST,
    defaults: '2026-01-30',
  };
}

export function isPostHogBrowserConfigured(env: BrowserEnv = process.env): boolean {
  return Boolean(resolvePostHogBrowserConfig(env));
}

// ─── Server (Node.js) ────────────────────────────────────────────────────────
// Prefers dedicated server-only vars. Falls back to the public key so
// environments that only provision NEXT_PUBLIC_ vars still work.

type ServerEnv = Partial<
  Record<
    | 'POSTHOG_KEY'
    | 'POSTHOG_HOST'
    | 'POSTHOG_PERSONAL_API_KEY'
    | 'NEXT_PUBLIC_POSTHOG_KEY',
    string
  >
>;

export type PostHogServerConfig = {
  apiKey: string;
  apiHost: string;
  personalApiKey?: string;
};

export function resolvePostHogServerConfig(
  env: ServerEnv = process.env,
): PostHogServerConfig | null {
  const apiKey = env.POSTHOG_KEY?.trim() || env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || '';
  if (!apiKey) return null;

  const personalApiKey = env.POSTHOG_PERSONAL_API_KEY?.trim() || undefined;

  return {
    apiKey,
    apiHost: env.POSTHOG_HOST?.trim() || POSTHOG_DEFAULT_HOST,
    ...(personalApiKey ? { personalApiKey } : {}),
  };
}
