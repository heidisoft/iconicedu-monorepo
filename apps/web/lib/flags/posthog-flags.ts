import 'server-only';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

type EvaluatePosthogBooleanFlagInput = {
  flagKey: string;
  distinctId: string;
  personProperties?: Record<string, unknown>;
  timeoutMs?: number;
};

const DEFAULT_POSTHOG_HOST = 'https://t.iconicedu.lk';
const DEFAULT_TIMEOUT_MS = 2500;

function isPosthogFlagDebugEnabled() {
  return process.env.DEBUG_POSTHOG_FLAGS === 'true';
}

function logPosthogFlagDebug(message: string, details: Record<string, unknown>) {
  if (!isPosthogFlagDebugEnabled()) {
    return;
  }

  console.info(`[PostHog Flags] ${message}`, details);
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

function isLocalWebEnvironment() {
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }
  const hostname = new URL(resolveAppUrl()).hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1';
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
  const isLocal = isLocalWebEnvironment();

  if (!distinctId || !flagKey || !apiKey || !host || isLocal) {
    logPosthogFlagDebug('Skipping flag evaluation', {
      flagKey,
      distinctId,
      hasApiKey: Boolean(apiKey),
      hasHost: Boolean(host),
      isLocalWebEnvironment: isLocal,
      result: false,
    });
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
      logPosthogFlagDebug('Flag evaluation failed with non-ok response', {
        flagKey,
        distinctId,
        status: response.status,
        result: false,
      });
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

    logPosthogFlagDebug('Flag evaluated', {
      flagKey,
      distinctId,
      rawValue: value,
      result,
    });

    return result;
  } catch {
    logPosthogFlagDebug('Flag evaluation threw', {
      flagKey,
      distinctId,
      result: false,
    });
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
