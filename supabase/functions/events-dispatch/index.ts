/* global Deno, Response, crypto */

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
  return Number.isFinite(value) ? value : undefined;
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
    const dispatchUrl = requireEnv('EVENTS_DISPATCH_URL');
    const internalToken = requireEnv('INTERNAL_EVENTS_TOKEN');
    const limit = asOptionalInt('EVENTS_DISPATCH_LIMIT');
    const leaseSeconds = asOptionalInt('EVENTS_DISPATCH_LEASE_SECONDS');
    const leaseOwner =
      asOptionalString('EVENTS_DISPATCH_LEASE_OWNER') ?? 'supabase-edge-cron';

    console.log('events_dispatch.started', {
      runId,
      dispatchUrl,
      limit: limit ?? null,
      leaseSeconds: leaseSeconds ?? null,
      leaseOwner,
    });

    const response = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        ...jsonHeaders,
        Authorization: `Bearer ${internalToken}`,
      },
      body: JSON.stringify({ limit, leaseSeconds, leaseOwner }),
    });

    const text = await response.text();
    if (!response.ok) {
      console.warn('events_dispatch.failed_upstream', {
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

    console.log('events_dispatch.succeeded', {
      runId,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        status: response.status,
        body: parseJsonOrRaw(text),
      }),
      { headers: jsonHeaders },
    );
  } catch (error) {
    console.error('events_dispatch.exception', {
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
