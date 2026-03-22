import Constants from 'expo-constants';

type MobileEnvSource = {
  expoExtra?: Record<string, unknown> | null;
  processEnv?: Record<string, string | undefined>;
};

function readExtraString(source: MobileEnvSource, ...keys: string[]): string | undefined {
  const extra = source.expoExtra ?? undefined;
  if (!extra) {
    return undefined;
  }

  for (const key of keys) {
    const value = extra[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function requireEnvValue(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return normalized;
}

function requireUrlEnvValue(value: string | undefined, name: string): string {
  const normalized = requireEnvValue(value, name);
  try {
    new URL(normalized);
    return normalized;
  } catch {
    throw new Error(`Environment variable ${name} must be a valid URL`);
  }
}

function isTestEnvironment() {
  return process.env.NODE_ENV === 'test';
}

function resolveSource(source?: MobileEnvSource): Required<MobileEnvSource> {
  return {
    expoExtra:
      source?.expoExtra ??
      (Constants.expoConfig?.extra as Record<string, unknown> | null) ??
      null,
    processEnv: source?.processEnv ?? process.env,
  };
}

export function getMobilePublicEnv(source?: MobileEnvSource) {
  const resolved = resolveSource(source);
  const supabaseUrl =
    readExtraString(resolved, 'supabaseUrl') ??
    resolved.processEnv.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    readExtraString(resolved, 'supabaseAnonKey') ??
    resolved.processEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (isTestEnvironment()) {
    return {
      supabaseUrl: supabaseUrl?.trim() || 'https://example.supabase.co',
      supabaseAnonKey: supabaseAnonKey?.trim() || 'test-anon-key',
    };
  }

  return {
    supabaseUrl: requireUrlEnvValue(supabaseUrl, 'EXPO_PUBLIC_SUPABASE_URL'),
    supabaseAnonKey: requireEnvValue(supabaseAnonKey, 'EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  };
}

export function getMobilePostHogEnv(source?: MobileEnvSource) {
  const resolved = resolveSource(source);
  return {
    posthogKey:
      readExtraString(resolved, 'posthogKey') ??
      resolved.processEnv.EXPO_PUBLIC_POSTHOG_KEY ??
      '',
    posthogHost:
      readExtraString(resolved, 'posthogHost') ??
      resolved.processEnv.EXPO_PUBLIC_POSTHOG_HOST ??
      'https://us.i.posthog.com',
  };
}

export function validateMobileRuntimeEnv(source?: MobileEnvSource) {
  return getMobilePublicEnv(source);
}
