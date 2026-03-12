/* global Deno, Response */

const jsonHeaders = { 'Content-Type': 'application/json' };

function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function fetchOrgIds(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<string[]> {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/orgs?select=id&deleted_at=is.null&limit=1000`,
    {
      method: 'GET',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to load orgs (${response.status}): ${body}`);
  }

  const data = (await response.json()) as Array<{ id?: string | null }>;
  return data
    .map((row) => row.id?.trim() ?? '')
    .filter((id): id is string => id.length > 0);
}

async function recomputeOrg(
  supabaseUrl: string,
  serviceRoleKey: string,
  orgId: string,
): Promise<number> {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/recompute_all_channel_unread_for_org`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ p_org_id: orgId }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Repair RPC failed for org ${orgId} (${response.status}): ${body}`);
  }

  const data = (await response.json()) as number | string | null;
  const count = typeof data === 'number' ? data : Number.parseInt(String(data ?? 0), 10);
  return Number.isFinite(count) ? count : 0;
}

Deno.serve(async () => {
  const startedAt = Date.now();

  try {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    const orgIds = await fetchOrgIds(supabaseUrl, serviceRoleKey);
    let repairedChannels = 0;

    for (const orgId of orgIds) {
      repairedChannels += await recomputeOrg(supabaseUrl, serviceRoleKey, orgId);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        orgCount: orgIds.length,
        repairedChannels,
        durationMs: Date.now() - startedAt,
      }),
      { headers: jsonHeaders },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: toErrorMessage(error),
        durationMs: Date.now() - startedAt,
      }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
