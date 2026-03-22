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
    new globalThis.URL(normalized);
    return normalized;
  } catch {
    throw new Error(`Environment variable ${name} must be a valid URL`);
  }
}

function requireDatabaseUrl(value: string | undefined, name: string): string {
  const normalized = requireEnvValue(value, name);
  if (!normalized.startsWith('postgresql://') && !normalized.startsWith('postgres://')) {
    throw new Error(
      `Environment variable ${name} must be a valid Postgres connection string`,
    );
  }
  return normalized;
}

export function getApiRuntimeEnv(source: EnvSource = process.env) {
  return {
    databaseUrl: requireDatabaseUrl(source.DATABASE_URL, 'DATABASE_URL'),
    directUrl: requireDatabaseUrl(source.DIRECT_URL, 'DIRECT_URL'),
    supabaseUrl: requireUrlEnvValue(source.SUPABASE_URL, 'SUPABASE_URL'),
    supabaseServiceRoleKey: requireEnvValue(
      source.SUPABASE_SERVICE_ROLE_KEY,
      'SUPABASE_SERVICE_ROLE_KEY',
    ),
    jwtSecret: requireEnvValue(source.JWT_SECRET, 'JWT_SECRET'),
  };
}

export function validateApiRuntimeEnv(source?: EnvSource) {
  return getApiRuntimeEnv(source);
}
