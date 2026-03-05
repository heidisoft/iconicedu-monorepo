/* global Deno, Response */

// Supabase Edge Function: reminders-dispatch
// Triggers the app's internal reminder dispatcher endpoint.

const jsonHeaders = { 'Content-Type': 'application/json' };

function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function asOptionalInt(name: string): number | undefined {
  const raw = Deno.env.get(name)?.trim();
  if (!raw) return undefined;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return undefined;
  return value;
}

function asOptionalString(name: string): string | undefined {
  const value = Deno.env.get(name)?.trim();
  return value ? value : undefined;
}

Deno.serve(async () => {
  try {
    const dispatchUrl = requireEnv('REMINDERS_DISPATCH_URL');
    const internalToken = requireEnv('INTERNAL_REMINDERS_TOKEN');
    const limit = asOptionalInt('REMINDERS_DISPATCH_LIMIT');
    const leaseSeconds = asOptionalInt('REMINDERS_DISPATCH_LEASE_SECONDS');
    const leaseOwner =
      asOptionalString('REMINDERS_DISPATCH_LEASE_OWNER') ?? 'supabase-edge-cron';

    const body = {
      limit,
      leaseSeconds,
      leaseOwner,
    };

    const response = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        ...jsonHeaders,
        Authorization: `Bearer ${internalToken}`,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          status: response.status,
          error: 'Dispatch endpoint returned non-2xx',
          body: text,
        }),
        { status: 500, headers: jsonHeaders },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        status: response.status,
        body: text ? JSON.parse(text) : null,
      }),
      { headers: jsonHeaders },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
