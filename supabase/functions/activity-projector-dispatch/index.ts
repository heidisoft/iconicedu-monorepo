/* global Deno, Response, crypto */

// Supabase Edge Function: activity-projector-dispatch
// Retries pending/failed activity feed projection work through apps/api.

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

function requireProjectorUrl(): string {
  const dispatchUrl = requireEnv('ACTIVITY_PROJECTOR_DISPATCH_URL');
  const url = new URL(dispatchUrl);

  if (url.pathname !== '/internal/activity-feed/project') {
    throw new Error(
      'ACTIVITY_PROJECTOR_DISPATCH_URL must target apps/api /internal/activity-feed/project',
    );
  }

  return url.toString();
}

Deno.serve(async () => {
  const runId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    const dispatchUrl = requireProjectorUrl();
    const internalToken = requireEnv('INTERNAL_ACTIVITY_PROJECTOR_TOKEN');
    const limit = asOptionalInt('ACTIVITY_PROJECTOR_DISPATCH_LIMIT');

    console.log('activity_projector_dispatch.started', {
      runId,
      dispatchUrl,
      limit: limit ?? null,
    });

    const response = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        ...jsonHeaders,
        Authorization: `Bearer ${internalToken}`,
      },
      body: JSON.stringify({ limit }),
    });

    const text = await response.text();
    if (!response.ok) {
      console.warn('activity_projector_dispatch.failed_upstream', {
        runId,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });
      return new Response(
        JSON.stringify({
          ok: false,
          status: response.status,
          error: 'Project endpoint returned non-2xx',
          body: parseJsonOrRaw(text),
        }),
        { status: 500, headers: jsonHeaders },
      );
    }

    console.log('activity_projector_dispatch.succeeded', {
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
    console.error('activity_projector_dispatch.exception', {
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
