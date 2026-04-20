import { NextResponse } from 'next/server';

import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';

const ALLOWED_KINDS = [
  'activity-worker-dispatch',
  'reminders-dispatch',
  'notifications-dispatch',
  'channel-read-state-repair',
] as const;

type FunctionKind = (typeof ALLOWED_KINDS)[number];

function isAllowedKind(kind: string): kind is FunctionKind {
  return (ALLOWED_KINDS as readonly string[]).includes(kind);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      orgId?: string;
      kind?: string;
      limit?: number;
      leaseOwner?: string;
    };

    const { orgId, kind, limit, leaseOwner } = body;

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { success: false, message: 'Supabase credentials not configured' },
        { status: 500 },
      );
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/${kind}`;

    const isReadStateRepair = kind === 'channel-read-state-repair';
    const requestBody = isReadStateRepair
      ? undefined
      : JSON.stringify({
          ...(limit != null ? { limit } : {}),
          leaseOwner: leaseOwner?.trim() || 'admin-tools',
        });

    const upstreamResponse = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      ...(requestBody ? { body: requestBody } : {}),
    });

    const text = await upstreamResponse.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return NextResponse.json(
      {
        success: upstreamResponse.ok,
        status: upstreamResponse.status,
        data,
      },
      { status: upstreamResponse.ok ? 200 : 502 },
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
