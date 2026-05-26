import { OpenFeature } from '@openfeature/server-sdk';
import type {
  EvaluationContext,
  JsonValue,
  Logger,
  Provider,
  ResolutionDetails,
} from '@openfeature/server-sdk';
import { platformFeatureFlagKeys } from '@iconicedu/shared-types';

export const apiFeatureFlagKeys = platformFeatureFlagKeys;

type ApiFeatureFlagKey = (typeof apiFeatureFlagKeys)[keyof typeof apiFeatureFlagKeys];

type EvaluateApiBooleanFlagInput = {
  flagKey: ApiFeatureFlagKey;
  distinctId: string;
  personProperties?: Record<string, string | number | boolean | null>;
  timeoutMs?: number;
};

const DEFAULT_POSTHOG_HOST = 'https://t.iconicedu.lk';
const DEFAULT_TIMEOUT_MS = 2500;
const PROVIDER_NAME = 'iconicedu-api-posthog-openfeature-provider';

function getPosthogHost() {
  return (process.env.POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST).trim();
}

function getPosthogKey() {
  return (process.env.POSTHOG_KEY ?? '').trim();
}

function isLocalOrPreviewApiEnvironment() {
  const appEnv = (
    process.env.APP_ENV ??
    process.env.API_ENV ??
    process.env.NODE_ENV ??
    ''
  )
    .trim()
    .toLowerCase();
  const vercelEnv = (process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV ?? '')
    .trim()
    .toLowerCase();
  const localUrlCandidates = [
    process.env.SUPABASE_URL,
    process.env.DATABASE_URL,
    process.env.DIRECT_URL,
  ]
    .map((value) => value?.trim().toLowerCase() ?? '')
    .filter(Boolean);
  const hasLocalServiceUrl = localUrlCandidates.some(
    (value) =>
      value.includes('localhost') ||
      value.includes('127.0.0.1') ||
      value.includes('host.docker.internal'),
  );

  return (
    appEnv === 'local' ||
    appEnv === 'preview' ||
    (appEnv === 'development' && process.env.CI !== 'true') ||
    vercelEnv === 'preview' ||
    hasLocalServiceUrl
  );
}

function getFeatureFlagValue(payload: unknown, flagKey: string) {
  if (!payload || typeof payload !== 'object') return undefined;

  const candidate = payload as {
    featureFlags?: Record<string, unknown>;
    feature_flags?: Record<string, unknown>;
  };
  const featureFlags = candidate.featureFlags ?? candidate.feature_flags;
  if (!featureFlags || typeof featureFlags !== 'object') return undefined;

  return featureFlags[flagKey];
}

function coerceBooleanFlagValue(value: unknown, defaultValue: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length > 0;
  if (typeof value === 'number') return value !== 0;
  return defaultValue;
}

class PosthogOpenFeatureProvider implements Provider {
  readonly metadata = { name: PROVIDER_NAME } as const;
  readonly runsOn = 'server' as const;

  async resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<boolean>> {
    const distinctId = context.targetingKey?.trim();
    const apiKey = getPosthogKey();
    const host = getPosthogHost();

    if (!distinctId || !flagKey.trim() || !apiKey || !host) {
      return { value: defaultValue, reason: 'DEFAULT' };
    }

    const controller = new AbortController();
    const timeoutMs =
      typeof context.timeoutMs === 'number' ? context.timeoutMs : DEFAULT_TIMEOUT_MS;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${host.replace(/\/$/, '')}/decide/?v=3`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          distinct_id: distinctId,
          person_properties:
            context.personProperties &&
            typeof context.personProperties === 'object' &&
            !Array.isArray(context.personProperties)
              ? context.personProperties
              : {},
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return { value: defaultValue, reason: 'ERROR' };
      }

      const payload = (await response.json()) as unknown;
      const value = getFeatureFlagValue(payload, flagKey);
      return {
        value: coerceBooleanFlagValue(value, defaultValue),
        variant: typeof value === 'string' ? value : undefined,
        reason: 'TARGETING_MATCH',
      };
    } catch {
      return { value: defaultValue, reason: 'ERROR' };
    } finally {
      clearTimeout(timeout);
    }
  }

  async resolveStringEvaluation(
    _flagKey: string,
    defaultValue: string,
  ): Promise<ResolutionDetails<string>> {
    return { value: defaultValue, reason: 'DEFAULT' };
  }

  async resolveNumberEvaluation(
    _flagKey: string,
    defaultValue: number,
  ): Promise<ResolutionDetails<number>> {
    return { value: defaultValue, reason: 'DEFAULT' };
  }

  async resolveObjectEvaluation<T extends JsonValue>(
    _flagKey: string,
    defaultValue: T,
    _context: EvaluationContext,
    _logger: Logger,
  ): Promise<ResolutionDetails<T>> {
    return { value: defaultValue, reason: 'DEFAULT' };
  }
}

let providerRegistered = false;

function getOpenFeatureClient() {
  if (!providerRegistered) {
    OpenFeature.setProvider(new PosthogOpenFeatureProvider());
    providerRegistered = true;
  }
  return OpenFeature.getClient('posthog');
}

export async function evaluateApiBooleanFlag(
  input: EvaluateApiBooleanFlagInput,
): Promise<boolean> {
  const distinctId = input.distinctId.trim();
  if (!distinctId) return false;
  if (isLocalOrPreviewApiEnvironment()) return true;

  return getOpenFeatureClient().getBooleanValue(input.flagKey, false, {
    targetingKey: distinctId,
    personProperties: input.personProperties ?? {},
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
}
