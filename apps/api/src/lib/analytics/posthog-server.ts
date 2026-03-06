import { PostHog } from 'posthog-node';

const POSTHOG_DEFAULT_HOST = 'https://us.i.posthog.com';

let posthogClient: PostHog | null | undefined;

function resolvePostHogConfig() {
  const apiKey =
    process.env.POSTHOG_KEY?.trim() || process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || '';

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    apiHost: process.env.POSTHOG_HOST?.trim() || POSTHOG_DEFAULT_HOST,
  };
}

function getPostHogClient() {
  if (posthogClient !== undefined) {
    return posthogClient;
  }

  const config = resolvePostHogConfig();
  if (!config) {
    posthogClient = null;
    return posthogClient;
  }

  posthogClient = new PostHog(config.apiKey, {
    host: config.apiHost,
    flushAt: 1,
    flushInterval: 0,
  });

  return posthogClient;
}

export async function capturePostHogServerEvent(input: {
  distinctId?: string;
  event: string;
  properties?: Record<string, unknown>;
  groups?: Record<string, string | number>;
}) {
  const client = getPostHogClient();
  if (!client) return;

  try {
    await Promise.race([
      client.captureImmediate({
        distinctId: input.distinctId ?? 'system',
        event: input.event,
        properties: input.properties,
        groups: input.groups,
      }),
      // Hard cap so telemetry never blocks the reminders dispatch pipeline.
      new Promise((resolve) => setTimeout(resolve, 400)),
    ]);
  } catch {
    // Telemetry must never break dispatch execution.
  }
}
