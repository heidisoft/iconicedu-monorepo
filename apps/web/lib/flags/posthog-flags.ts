import 'server-only';

type EvaluatePosthogBooleanFlagInput = {
  flagKey: string;
  distinctId: string;
  personProperties?: Record<string, unknown>;
  timeoutMs?: number;
};

const DEFAULT_POSTHOG_HOST = 'https://t.iconicedu.lk';
const DEFAULT_TIMEOUT_MS = 2500;

function getPosthogHost() {
  return (
    process.env.POSTHOG_HOST ??
    process.env.NEXT_PUBLIC_POSTHOG_HOST ??
    DEFAULT_POSTHOG_HOST
  ).trim();
}

function getPosthogKey() {
  return (process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '').trim();
}

function getFeatureFlagValue(payload: unknown, flagKey: string) {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const candidate = payload as {
    featureFlags?: Record<string, unknown>;
    feature_flags?: Record<string, unknown>;
  };

  const featureFlags = candidate.featureFlags ?? candidate.feature_flags;
  if (!featureFlags || typeof featureFlags !== 'object') {
    return undefined;
  }

  return (featureFlags as Record<string, unknown>)[flagKey];
}

export async function evaluatePosthogBooleanFlag(
  input: EvaluatePosthogBooleanFlagInput,
): Promise<boolean> {
  const distinctId = input.distinctId.trim();
  const flagKey = input.flagKey.trim();
  const apiKey = getPosthogKey();
  const host = getPosthogHost();

  if (!distinctId || !flagKey || !apiKey || !host) {
    return false;
  }

  const controller = new AbortController();
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${host.replace(/\/$/, '')}/decide/?v=3`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        distinct_id: distinctId,
        person_properties: input.personProperties ?? {},
      }),
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      return false;
    }

    const payload = (await response.json()) as unknown;
    const value = getFeatureFlagValue(payload, flagKey);

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      return value.length > 0;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    return false;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
