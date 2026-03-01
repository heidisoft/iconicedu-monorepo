type PostHogServerEnv = NodeJS.ProcessEnv &
  Partial<
    Record<
      | 'POSTHOG_KEY'
      | 'POSTHOG_HOST'
      | 'POSTHOG_PERSONAL_API_KEY'
      | 'NEXT_PUBLIC_POSTHOG_KEY'
      | 'NEXT_PUBLIC_POSTHOG_TOKEN'
      | 'NEXT_PUBLIC_POSTHOG_HOST',
      string
    >
  >;

export type PostHogServerConfig = {
  apiKey: string;
  apiHost: string;
  personalApiKey?: string;
};

const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

export function resolvePostHogServerConfig(
  env: PostHogServerEnv = process.env,
): PostHogServerConfig | null {
  const apiKey =
    env.POSTHOG_KEY?.trim() ||
    env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ||
    env.NEXT_PUBLIC_POSTHOG_TOKEN?.trim() ||
    '';

  if (!apiKey) {
    return null;
  }

  const apiHost =
    env.POSTHOG_HOST?.trim() ||
    env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ||
    DEFAULT_POSTHOG_HOST;

  const personalApiKey = env.POSTHOG_PERSONAL_API_KEY?.trim() || undefined;

  return {
    apiKey,
    apiHost,
    ...(personalApiKey ? { personalApiKey } : {}),
  };
}
