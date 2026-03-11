/* global Deno, Response, crypto */

// Supabase Edge Function: notifications-dispatch
// Triggers the app's internal notifications dispatcher endpoint.

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

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function parseJsonOrRaw(body: string) {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

Deno.serve(async () => {
  const runId = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    const dispatchUrl = requireEnv('NOTIFICATIONS_DISPATCH_URL');
    const internalToken = requireEnv('INTERNAL_NOTIFICATIONS_TOKEN');
    const limit = asOptionalInt('NOTIFICATIONS_DISPATCH_LIMIT');
    const leaseSeconds = asOptionalInt('NOTIFICATIONS_DISPATCH_LEASE_SECONDS');
    const leaseOwner =
      asOptionalString('NOTIFICATIONS_DISPATCH_LEASE_OWNER') ?? 'supabase-edge-cron';

    console.log('notifications_dispatch.started', {
      runId,
      dispatchUrl,
      limit: limit ?? null,
      leaseSeconds: leaseSeconds ?? null,
      leaseOwner,
    });

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
      console.warn('notifications_dispatch.failed_upstream', {
        runId,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });
      return new Response(
        JSON.stringify({
          ok: false,
          status: response.status,
          error: 'Dispatch endpoint returned non-2xx',
          body: parseJsonOrRaw(text),
        }),
        { status: 500, headers: jsonHeaders },
      );
    }

    const parsedBody = parseJsonOrRaw(text);
    console.log('notifications_dispatch.succeeded', {
      runId,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        status: response.status,
        body: parsedBody,
      }),
      { headers: jsonHeaders },
    );
  } catch (error) {
    console.error('notifications_dispatch.exception', {
      runId,
      durationMs: Date.now() - startedAt,
      error: toErrorMessage(error),
    });
    return new Response(
      JSON.stringify({
        ok: false,
        error: toErrorMessage(error),
      }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
