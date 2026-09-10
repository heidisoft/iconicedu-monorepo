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
  // NEXT_PUBLIC_SUPABASE_URL — kept as NEXT_PUBLIC_ so Next.js inlines it into client bundles.
  // SUPABASE_URL — Vercel+Supabase connector name (server-side only, not available in browser).
  const url = source.NEXT_PUBLIC_SUPABASE_URL ?? source.SUPABASE_URL;
  return requireUrlEnvValue(url, 'NEXT_PUBLIC_SUPABASE_URL');
}

function getServiceRoleKey(source: EnvSource): string {
  return requireEnvValue(source.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');
}

function getTurnstileSiteKey(source: EnvSource): string | null {
  // NEXT_PUBLIC_TURNSTILE_SITE_KEY — Cloudflare Turnstile public site key.
  // Optional: when unset the auth forms render no widget and send no
  // captchaToken, which is correct while Supabase Attack Protection is disabled.
  return source.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
}

function getPublishableKey(source: EnvSource): string {
  // NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — Vercel+Supabase connector name.
  // NEXT_PUBLIC_SUPABASE_ANON_KEY — fallback for local dev / manual setup.
  const key =
    source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? source.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (key?.trim()) {
    return key.trim();
  }
  throw new Error(
    'Missing required environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  );
}

export function getPublicWebEnv(source?: EnvSource) {
  // Build an explicit object with literal process.env access so Next.js can
  // statically inline NEXT_PUBLIC_* values into the client bundle.
  const s = source ?? {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL, // Vercel+Supabase connector (server-side only)
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  };
  return {
    supabaseUrl: getPublicSupabaseUrl(s),
    supabasePublishableKey: getPublishableKey(s),
    turnstileSiteKey: getTurnstileSiteKey(s),
  };
}

export function getServiceWebEnv(source: EnvSource = process.env) {
  return {
    ...getPublicWebEnv(source),
    supabaseServiceRoleKey: getServiceRoleKey(source),
  };
}

/**
 * Cloudflare Turnstile site key, or null when unconfigured. Standalone (does not
 * require the Supabase env) so auth UI can read it without pulling in the whole
 * public env — literal process.env access keeps Next.js inlining intact.
 */
export function getPublicTurnstileSiteKey(source?: EnvSource): string | null {
  const s = source ?? {
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  };
  return getTurnstileSiteKey(s);
}
