import 'server-only';

import { PostHog } from 'posthog-node';

import { resolvePostHogServerConfig } from './posthog-server-config';

let posthogServerClient: PostHog | null | undefined;

export function getPostHogServerClient() {
  if (posthogServerClient !== undefined) {
    return posthogServerClient;
  }

  const config = resolvePostHogServerConfig();
  if (!config) {
    posthogServerClient = null;
    return posthogServerClient;
  }

  posthogServerClient = new PostHog(config.apiKey, {
    host: config.apiHost,
    ...(config.personalApiKey ? { personalApiKey: config.personalApiKey } : {}),
    flushAt: 1,
    flushInterval: 0,
  });

  return posthogServerClient;
}

export async function capturePostHogServerEvent(input: {
  distinctId?: string;
  event: string;
  properties?: Record<string | number, unknown>;
  groups?: Record<string, string | number>;
}) {
  const client = getPostHogServerClient();
  if (!client) {
    return;
  }

  await client.captureImmediate({
    distinctId: input.distinctId ?? 'anonymous',
    event: input.event,
    properties: input.properties,
    groups: input.groups,
  });
}

export async function capturePostHogServerException(
  error: unknown,
  input?: {
    distinctId?: string;
    properties?: Record<string | number, unknown>;
  },
) {
  const client = getPostHogServerClient();
  if (!client) {
    return;
  }

  await client.captureExceptionImmediate(error, input?.distinctId, input?.properties);
}

export async function getPostHogServerFeatureFlag(
  key: string,
  distinctId: string,
  options?: {
    groups?: Record<string, string>;
    personProperties?: Record<string, string>;
    groupProperties?: Record<string, Record<string, string>>;
  },
) {
  const client = getPostHogServerClient();
  if (!client) {
    return undefined;
  }

  return client.getFeatureFlag(key, distinctId, options);
}
