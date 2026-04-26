/* global Deno, Response, crypto */

// Supabase Edge Function: reminders-dispatch
// Triggers the API-owned reminder dispatcher endpoint.
//
// This function must stay a thin HTTP bridge. Reminder jobs are compiled when
// schedules change; the per-minute cron should only ask apps/api to claim due
// rows from reminder_jobs. Do not read class_schedules from this function.

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

function requireApiDispatchUrl(): string {
  const dispatchUrl = requireEnv('REMINDERS_DISPATCH_URL');
  const url = new URL(dispatchUrl);

  if (url.pathname !== '/internal/reminders/dispatch') {
    throw new Error(
      'REMINDERS_DISPATCH_URL must target apps/api /internal/reminders/dispatch',
    );
  }

  return url.toString();
}

Deno.serve(async () => {
  const runId = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    const dispatchUrl = requireApiDispatchUrl();
    const internalToken = requireEnv('INTERNAL_REMINDERS_TOKEN');
    const limit = asOptionalInt('REMINDERS_DISPATCH_LIMIT');
    const leaseSeconds = asOptionalInt('REMINDERS_DISPATCH_LEASE_SECONDS');
    const leaseOwner =
      asOptionalString('REMINDERS_DISPATCH_LEASE_OWNER') ?? 'supabase-edge-cron';

    console.log('reminders_dispatch.started', {
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
      console.warn('reminders_dispatch.failed_upstream', {
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
    console.log('reminders_dispatch.succeeded', {
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
    console.error('reminders_dispatch.exception', {
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
