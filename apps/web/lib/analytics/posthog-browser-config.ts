type PostHogEnv = NodeJS.ProcessEnv &
  Partial<
    Record<'NEXT_PUBLIC_POSTHOG_KEY' | 'NEXT_PUBLIC_POSTHOG_TOKEN' | 'NEXT_PUBLIC_POSTHOG_HOST', string>
  >;

export type PostHogBrowserConfig = {
  apiKey: string;
  apiHost: string;
  defaults: '2026-01-30';
};

const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

export function resolvePostHogBrowserConfig(env: PostHogEnv = process.env): PostHogBrowserConfig | null {
  const apiKey = env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || env.NEXT_PUBLIC_POSTHOG_TOKEN?.trim() || '';

  if (!apiKey) {
    return null;
  }

  const apiHost = env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST;

  return {
    apiKey,
    apiHost,
    defaults: '2026-01-30',
  };
}
