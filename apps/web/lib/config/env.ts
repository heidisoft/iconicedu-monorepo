type EnvSource = Record<string, string | undefined>;

function requireEnv(source: EnvSource, name: string): string {
  const value = source[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requireUrlEnv(source: EnvSource, name: string): string {
  const value = requireEnv(source, name);
  try {
    new URL(value);
    return value;
  } catch {
    throw new Error(`Environment variable ${name} must be a valid URL`);
  }
}

function getPublishableKey(source: EnvSource): string {
  return (
    source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
    source.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    (() => {
      throw new Error(
        'Missing required environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
      );
    })()
  );
}

export function getPublicWebEnv(source: EnvSource = process.env) {
  return {
    supabaseUrl: requireUrlEnv(source, 'NEXT_PUBLIC_SUPABASE_URL'),
    supabasePublishableKey: getPublishableKey(source),
  };
}

export function getServiceWebEnv(source: EnvSource = process.env) {
  return {
    ...getPublicWebEnv(source),
    supabaseServiceRoleKey: requireEnv(source, 'SUPABASE_SERVICE_ROLE_KEY'),
  };
}
