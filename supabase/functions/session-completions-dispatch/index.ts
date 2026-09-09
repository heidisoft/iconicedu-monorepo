/* global Deno, Response */

// Thin bridge: queue claiming and all domain behavior are owned by apps/api.
Deno.serve(async () => {
  try {
    const apiUrl = Deno.env.get('REMINDERS_DISPATCH_URL')?.trim();
    const token = Deno.env.get('INTERNAL_REMINDERS_TOKEN')?.trim();
    if (!apiUrl || !token) throw new Error('Missing dispatch URL or internal token');
    const url = new URL('/internal/session-completions/dispatch', apiUrl);
    const positiveInt = (key: string, fallback: number) => {
      const value = Number(Deno.env.get(key));
      return Number.isInteger(value) && value > 0 ? value : fallback;
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        limit: positiveInt('SESSION_COMPLETIONS_DISPATCH_LIMIT', 100),
        leaseSeconds: positiveInt('SESSION_COMPLETIONS_DISPATCH_LEASE_SECONDS', 120),
        leaseOwner: 'session-completions-edge-cron',
      }),
    });
    if (!response.ok) {
      console.error('session-completions_dispatch.failed', { status: response.status });
      return Response.json({ ok: false, status: response.status }, { status: 502 });
    }
    const result = await response.json();
    console.log('session-completions_dispatch.completed', result);
    return Response.json({ ok: true, result });
  } catch (error) {
    console.error(
      'session-completions_dispatch.failed',
      error instanceof Error ? error.message : String(error),
    );
    return Response.json({ ok: false }, { status: 500 });
  }
});
