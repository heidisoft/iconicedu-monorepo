import { NextResponse } from 'next/server';

import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

const ALLOWED_KINDS = [
  'activity-worker-dispatch',
  'activity-projector-dispatch',
  'reminders-dispatch',
  'notifications-dispatch',
  'channel-read-state-repair',
] as const;

type FunctionKind = (typeof ALLOWED_KINDS)[number];

type AdminToolsDispatchRequest = {
  orgId?: string;
  kind?: string;
  limit?: number;
  leaseSeconds?: number;
  leaseOwner?: string;
};

function isAllowedKind(kind: string): kind is FunctionKind {
  return (ALLOWED_KINDS as readonly string[]).includes(kind);
}

function resolveInternalApiUrl() {
  const configuredUrl = (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    ''
  ).trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3001';
  }

  return '';
}

function resolveInternalToken(kind: FunctionKind) {
  switch (kind) {
    case 'activity-worker-dispatch':
      return (
        process.env.INTERNAL_ACTIVITY_WORKER_TOKEN_API?.trim() ||
        process.env.INTERNAL_ACTIVITY_WORKER_TOKEN?.trim() ||
        ''
      );
    case 'activity-projector-dispatch':
      return process.env.INTERNAL_ACTIVITY_PROJECTOR_TOKEN?.trim() || '';
    case 'reminders-dispatch':
      return (
        process.env.INTERNAL_REMINDERS_TOKEN_API?.trim() ||
        process.env.INTERNAL_REMINDERS_TOKEN?.trim() ||
        ''
      );
    case 'notifications-dispatch':
      return (
        process.env.INTERNAL_NOTIFICATIONS_TOKEN_API?.trim() ||
        process.env.INTERNAL_NOTIFICATIONS_TOKEN?.trim() ||
        ''
      );
    case 'channel-read-state-repair':
      return '';
  }
}

function resolveApiPath(kind: FunctionKind) {
  switch (kind) {
    case 'activity-worker-dispatch':
      return '/internal/activity-worker/dispatch';
    case 'activity-projector-dispatch':
      return '/internal/activity-feed/project';
    case 'reminders-dispatch':
      return '/internal/reminders/dispatch';
    case 'notifications-dispatch':
      return '/internal/notifications/dispatch';
    case 'channel-read-state-repair':
      return null;
  }
}

function asOptionalPositiveInt(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : undefined;
}

function asOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function buildCronBridgeBody(kind: FunctionKind, body: AdminToolsDispatchRequest) {
  const limit = asOptionalPositiveInt(body.limit);
  const leaseSeconds = asOptionalPositiveInt(body.leaseSeconds);
  const leaseOwner = asOptionalString(body.leaseOwner) ?? 'supabase-edge-cron';

  if (kind === 'activity-projector-dispatch') {
    return { ...(limit != null ? { limit } : {}) };
  }

  return {
    ...(limit != null ? { limit } : {}),
    ...(leaseSeconds != null ? { leaseSeconds } : {}),
    leaseOwner,
  };
}

function parseJsonOrRaw(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function runApiBackedCronJob(kind: FunctionKind, body: AdminToolsDispatchRequest) {
  const internalApiUrl = resolveInternalApiUrl();
  const token = resolveInternalToken(kind);
  const apiPath = resolveApiPath(kind);

  if (!apiPath) {
    throw new Error(`${kind} does not have an API dispatch endpoint`);
  }

  if (!internalApiUrl || !token) {
    throw new Error(
      'API_URL/NEXT_PUBLIC_API_URL and the matching internal dispatch token are required',
    );
  }

  const startedAt = Date.now();
  const requestBody = buildCronBridgeBody(kind, body);
  const upstreamResponse = await fetch(`${internalApiUrl}${apiPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const text = await upstreamResponse.text();
  const parsedBody = parseJsonOrRaw(text);

  return {
    success: upstreamResponse.ok,
    status: upstreamResponse.status,
    data: upstreamResponse.ok
      ? {
          ok: true,
          status: upstreamResponse.status,
          body: parsedBody,
          cron: {
            kind,
            target: apiPath,
            requestBody,
            durationMs: Date.now() - startedAt,
          },
        }
      : {
          ok: false,
          status: upstreamResponse.status,
          error: 'Dispatch endpoint returned non-2xx',
          body: parsedBody,
          cron: {
            kind,
            target: apiPath,
            requestBody,
            durationMs: Date.now() - startedAt,
          },
        },
  };
}

async function runChannelReadStateRepairCronJob() {
  const startedAt = Date.now();
  const supabase = createSupabaseServiceClient();
  const orgsResponse = await supabase
    .from('orgs')
    .select('id')
    .is('deleted_at', null)
    .limit(1000);

  if (orgsResponse.error) {
    throw new Error(orgsResponse.error.message);
  }

  const orgIds = (orgsResponse.data ?? [])
    .map((row: { id?: string | null }) => row.id?.trim() ?? '')
    .filter((id): id is string => id.length > 0);

  let repairedChannels = 0;

  for (const orgId of orgIds) {
    const repairResponse = await supabase.rpc('recompute_all_channel_unread_for_org', {
      p_org_id: orgId,
    });

    if (repairResponse.error) {
      throw new Error(repairResponse.error.message);
    }

    const count =
      typeof repairResponse.data === 'number'
        ? repairResponse.data
        : Number.parseInt(String(repairResponse.data ?? 0), 10);
    repairedChannels += Number.isFinite(count) ? count : 0;
  }

  return {
    success: true,
    status: 200,
    data: {
      ok: true,
      orgCount: orgIds.length,
      repairedChannels,
      durationMs: Date.now() - startedAt,
      cron: {
        kind: 'channel-read-state-repair',
        target: 'rpc:recompute_all_channel_unread_for_org',
      },
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AdminToolsDispatchRequest;

    const { orgId, kind } = body;

    if (!orgId) {
      return NextResponse.json(
        { success: false, message: 'orgId is required' },
        { status: 400 },
      );
    }

    if (!kind || !isAllowedKind(kind)) {
      return NextResponse.json(
        { success: false, message: `kind must be one of: ${ALLOWED_KINDS.join(', ')}` },
        { status: 400 },
      );
    }

    const auth = await requireAdminOrgContext(orgId);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, message: auth.message },
        { status: auth.status },
      );
    }

    const result =
      kind === 'channel-read-state-repair'
        ? await runChannelReadStateRepairCronJob()
        : await runApiBackedCronJob(kind, body);

    return NextResponse.json(
      {
        success: result.success,
        status: result.status,
        data: result.data,
      },
      { status: result.success ? 200 : 502 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
