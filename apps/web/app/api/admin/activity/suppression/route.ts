import { NextResponse } from 'next/server';

import type {
  ActivityEventSuppressionRuleRow,
  ActivityVerbSuppressionRuleVM,
  DeleteActivityVerbSuppressionRuleInput,
  UpsertActivityVerbSuppressionRuleInput,
} from '@iconicedu/shared-types';
import { listActivityEventDefinitionTypes } from '@iconicedu/api/lib/activity-feed/definitions/activity-definitions';
import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

function asRuleVm(row: ActivityEventSuppressionRuleRow): ActivityVerbSuppressionRuleVM {
  return {
    id: row.id,
    orgId: row.org_id,
    eventType: row.event_type,
    actorProfileId: row.actor_profile_id ?? null,
    scope: row.actor_profile_id ? 'actor' : 'org',
    isEnabled: row.is_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId');

  if (!orgId) {
    return NextResponse.json(
      { success: false, message: 'orgId is required' },
      { status: 400 },
    );
  }

  try {
    const authContext = await requireAdminOrgContext(orgId);
    if (!authContext.ok) {
      return NextResponse.json(
        { success: false, message: authContext.message },
        { status: authContext.status },
      );
    }

    const serviceSupabase = createSupabaseServiceClient();
    const [rulesResponse, profilesResponse, eventsResponse] = await Promise.all([
      serviceSupabase
        .from('activity_event_suppression_rules')
        .select('*')
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .order('event_type', { ascending: true })
        .returns<ActivityEventSuppressionRuleRow[]>(),
      serviceSupabase
        .from('profiles')
        .select('id, display_name')
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .order('display_name', { ascending: true })
        .returns<Array<{ id: string; display_name: string | null }>>(),
      serviceSupabase
        .from('activity_events')
        .select('event_type')
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .limit(1000)
        .returns<Array<{ event_type: string }>>(),
    ]);

    if (rulesResponse.error) {
      return NextResponse.json(
        { success: false, message: rulesResponse.error.message },
        { status: 500 },
      );
    }
    if (profilesResponse.error) {
      return NextResponse.json(
        { success: false, message: profilesResponse.error.message },
        { status: 500 },
      );
    }
    if (eventsResponse.error) {
      return NextResponse.json(
        { success: false, message: eventsResponse.error.message },
        { status: 500 },
      );
    }

    const knownEventTypes = new Set(listActivityEventDefinitionTypes());
    const discoveredEventTypes = new Set(
      (eventsResponse.data ?? []).map((row) => row.event_type),
    );
    for (const rule of rulesResponse.data ?? []) {
      discoveredEventTypes.add(rule.event_type);
    }

    const verbCatalog = Array.from(new Set([...knownEventTypes, ...discoveredEventTypes]))
      .sort()
      .map((eventType) => ({
        eventType,
        isKnown: knownEventTypes.has(eventType),
        isReadOnly: !knownEventTypes.has(eventType),
      }));

    const rules = (rulesResponse.data ?? []).map(asRuleVm);
    const orgRules = rules.filter((rule) => rule.scope === 'org');
    const actorRules = rules.filter((rule) => rule.scope === 'actor');

    const profiles = (profilesResponse.data ?? []).map((profile) => ({
      profileId: profile.id,
      displayName: profile.display_name ?? 'Unknown',
    }));

    return NextResponse.json({
      success: true,
      data: {
        orgRules,
        actorRules,
        verbCatalog,
        profiles,
      },
    });
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

export async function POST(request: Request) {
  const payload = (await request.json()) as UpsertActivityVerbSuppressionRuleInput;
  const orgId = payload.orgId;
  const eventType = payload.eventType?.trim();
  const actorProfileId = payload.actorProfileId?.trim() || null;

  if (!orgId || !eventType || typeof payload.isEnabled !== 'boolean') {
    return NextResponse.json(
      { success: false, message: 'Missing required fields.' },
      { status: 400 },
    );
  }

  try {
    const authContext = await requireAdminOrgContext(orgId);
    if (!authContext.ok) {
      return NextResponse.json(
        { success: false, message: authContext.message },
        { status: authContext.status },
      );
    }

    const now = new Date().toISOString();
    const serviceSupabase = createSupabaseServiceClient();
    const updateQuery = serviceSupabase
      .from('activity_event_suppression_rules')
      .update({
        is_enabled: payload.isEnabled,
        updated_at: now,
        updated_by: authContext.actorProfileId,
        deleted_at: null,
        deleted_by: null,
      })
      .eq('org_id', orgId)
      .eq('event_type', eventType)
      .is('deleted_at', null);

    if (actorProfileId) {
      updateQuery.eq('actor_profile_id', actorProfileId);
    } else {
      updateQuery.is('actor_profile_id', null);
    }

    const updateResponse = await updateQuery
      .select('*')
      .maybeSingle<ActivityEventSuppressionRuleRow>();

    if (updateResponse.error) {
      return NextResponse.json(
        { success: false, message: updateResponse.error.message },
        { status: 500 },
      );
    }

    const updated = updateResponse.data;
    if (updated) {
      return NextResponse.json({ success: true, rule: asRuleVm(updated) });
    }

    const insertResponse = await serviceSupabase
      .from('activity_event_suppression_rules')
      .insert({
        org_id: orgId,
        event_type: eventType,
        actor_profile_id: actorProfileId,
        is_enabled: payload.isEnabled,
        created_at: now,
        created_by: authContext.actorProfileId,
        updated_at: now,
        updated_by: authContext.actorProfileId,
      })
      .select('*')
      .single<ActivityEventSuppressionRuleRow>();

    if (insertResponse.error) {
      return NextResponse.json(
        { success: false, message: insertResponse.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, rule: asRuleVm(insertResponse.data) });
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

export async function DELETE(request: Request) {
  const payload = (await request.json()) as DeleteActivityVerbSuppressionRuleInput;
  const orgId = payload.orgId;
  const eventType = payload.eventType?.trim();
  const actorProfileId = payload.actorProfileId?.trim() || null;

  if (!orgId || !eventType) {
    return NextResponse.json(
      { success: false, message: 'Missing required fields.' },
      { status: 400 },
    );
  }

  try {
    const authContext = await requireAdminOrgContext(orgId);
    if (!authContext.ok) {
      return NextResponse.json(
        { success: false, message: authContext.message },
        { status: authContext.status },
      );
    }

    const now = new Date().toISOString();
    const serviceSupabase = createSupabaseServiceClient();
    const deleteQuery = serviceSupabase
      .from('activity_event_suppression_rules')
      .update({
        deleted_at: now,
        deleted_by: authContext.actorProfileId,
        updated_at: now,
        updated_by: authContext.actorProfileId,
      })
      .eq('org_id', orgId)
      .eq('event_type', eventType)
      .is('deleted_at', null);

    if (actorProfileId) {
      deleteQuery.eq('actor_profile_id', actorProfileId);
    } else {
      deleteQuery.is('actor_profile_id', null);
    }

    const deleteResponse = await deleteQuery
      .select('*')
      .returns<ActivityEventSuppressionRuleRow[]>();

    if (deleteResponse.error) {
      return NextResponse.json(
        { success: false, message: deleteResponse.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      deletedCount: deleteResponse.data?.length ?? 0,
    });
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
