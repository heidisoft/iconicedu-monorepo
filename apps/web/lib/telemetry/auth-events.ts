export type AuthTelemetryEvent =
  | 'auth_start_google'
  | 'auth_start_email'
  | 'auth_magiclink_sent'
  | 'auth_success'
  | 'onboarding_role_selected'
  | 'onboarding_invitecode_submitted';

export async function trackAuthTelemetry(
  event: AuthTelemetryEvent,
  payload?: Record<string, unknown>,
) {
  try {
    await fetch('/api/telemetry/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, payload: payload ?? null }),
      keepalive: true,
      credentials: 'same-origin',
    });
  } catch {
    // Intentionally swallow telemetry errors.
  }
}
