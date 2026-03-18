import 'server-only';

type EvaluatePosthogBooleanFlagInput = {
  flagKey: string;
  distinctId: string;
  personProperties?: Record<string, unknown>;
  timeoutMs?: number;
};

const DEFAULT_POSTHOG_HOST = 'https://t.iconicedu.lk';
const DEFAULT_TIMEOUT_MS = 2500;

function isPosthogFlagDebugEnabled() {
  return process.env.DEBUG_POSTHOG_FLAGS?.trim() === 'true';
}

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
  const isDebugEnabled = isPosthogFlagDebugEnabled();

  if (!distinctId || !flagKey || !apiKey || !host) {
    if (isDebugEnabled) {
      console.info('[posthog-flags]', 'evaluation-skipped', {
        flagKey,
        hasDistinctId: Boolean(distinctId),
        hasApiKey: Boolean(apiKey),
        hasHost: Boolean(host),
      });
    }
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
      if (isDebugEnabled) {
        console.info('[posthog-flags]', 'evaluation-failed', {
          flagKey,
          status: response.status,
        });
      }
      return false;
    }

    const payload = (await response.json()) as unknown;
    const value = getFeatureFlagValue(payload, flagKey);
    const result =
      typeof value === 'boolean'
        ? value
        : typeof value === 'string'
          ? value.length > 0
          : typeof value === 'number'
            ? value !== 0
            : false;

    if (isDebugEnabled) {
      console.info('[posthog-flags]', 'evaluation-result', {
        flagKey,
        distinctId,
        rawValueType: value === undefined ? 'undefined' : typeof value,
        rawValue:
          typeof value === 'string'
            ? value.slice(0, 64)
            : typeof value === 'number'
              ? value
              : (value ?? null),
        result,
      });
    }

    return result;
  } catch {
    if (isDebugEnabled) {
      console.info('[posthog-flags]', 'evaluation-exception', {
        flagKey,
      });
    }
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
