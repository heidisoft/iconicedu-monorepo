type EnvSource = Record<string, string | undefined>;

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

function getPublicSupabaseUrl(source: EnvSource): string {
  // Keep direct property access so Next.js can inline NEXT_PUBLIC_* vars for client bundles.
  return requireUrlEnvValue(source.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL');
}

function getServiceRoleKey(source: EnvSource): string {
  return requireEnvValue(source.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');
}

function getPublishableKey(source: EnvSource): string {
  const publishable = source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (publishable?.trim()) {
    return publishable.trim();
  }
  const anon = source.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (anon?.trim()) {
    return anon.trim();
  }
  throw new Error(
    'Missing required environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
  );
}

export function getPublicWebEnv(source?: EnvSource) {
  // Build an explicit object with literal process.env access so Next.js can
  // statically inline NEXT_PUBLIC_* values into the client bundle.
  const s = source ?? {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  return {
    supabaseUrl: getPublicSupabaseUrl(s),
    supabasePublishableKey: getPublishableKey(s),
  };
}

export function getServiceWebEnv(source: EnvSource = process.env) {
  return {
    ...getPublicWebEnv(source),
    supabaseServiceRoleKey: getServiceRoleKey(source),
  };
}

export function validateWebRuntimeEnv(source: EnvSource = process.env) {
  return getServiceWebEnv(source);
}
