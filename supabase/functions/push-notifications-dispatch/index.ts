/* global Deno, Response */

// Thin bridge: queue claiming and all domain behavior are owned by apps/api.
Deno.serve(async () => {
  try {
    const apiUrl = Deno.env.get('EVENTS_DISPATCH_URL')?.trim();
    const token = Deno.env.get('INTERNAL_EVENTS_TOKEN')?.trim();
    if (!apiUrl || !token) throw new Error('Missing dispatch URL or internal token');
    const url = new URL('/internal/push-notifications/dispatch', apiUrl);
    const positiveInt = (key: string, fallback: number) => {
      const value = Number(Deno.env.get(key));
      return Number.isInteger(value) && value > 0 ? value : fallback;
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        limit: positiveInt('PUSH_NOTIFICATIONS_DISPATCH_LIMIT', 100),
        leaseSeconds: positiveInt('PUSH_NOTIFICATIONS_DISPATCH_LEASE_SECONDS', 120),
        leaseOwner: 'push-notifications-edge-cron',
      }),
    });
    if (!response.ok) {
      console.error('push-notifications_dispatch.failed', { status: response.status });
      return Response.json({ ok: false, status: response.status }, { status: 502 });
    }
    const result = await response.json();
    console.log('push-notifications_dispatch.completed', result);
    return Response.json({ ok: true, result });
  } catch (error) {
    console.error(
      'push-notifications_dispatch.failed',
      error instanceof Error ? error.message : String(error),
    );
    return Response.json({ ok: false }, { status: 500 });
  }
});
