import { NextResponse } from 'next/server';

import type {
  DeleteNotificationPreferenceInput,
  NotificationPreferenceScopeRow,
  UpsertNotificationPreferenceInput,
} from '@iconicedu/shared-types';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

type ScopeKind = 'channel' | 'learning_space';

function isScopeKind(value: unknown): value is ScopeKind {
  return value === 'channel' || value === 'learning_space';
}

async function requireOwnerContext() {
  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const accountResponse = await getAccountByAuthUserId(supabase, authUser.id);
  if (!accountResponse.data) {
    throw new Error('Account not found');
  }
  const profileResponse = await getProfileByAccountId(supabase, accountResponse.data.id);
  if (!profileResponse.data) {
    throw new Error('Profile not found');
  }
  return {
    supabase,
    orgId: accountResponse.data.org_id,
    profileId: profileResponse.data.id,
  };
}

function enforceOwnerScope(input: {
  requestedOrgId: string;
  requestedProfileId: string;
  ownerOrgId: string;
  ownerProfileId: string;
}) {
  if (
    input.requestedOrgId !== input.ownerOrgId ||
    input.requestedProfileId !== input.ownerProfileId
  ) {
    throw new Error('Forbidden');
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId');
  const profileId = searchParams.get('profileId');
  const scopeKindRaw = searchParams.get('scopeKind');
  const scopeId = searchParams.get('scopeId');

  if (!orgId || !profileId) {
    return NextResponse.json(
      { success: false, message: 'orgId and profileId are required.' },
      { status: 400 },
    );
  }

  try {
    const owner = await requireOwnerContext();
    enforceOwnerScope({
      requestedOrgId: orgId,
      requestedProfileId: profileId,
      ownerOrgId: owner.orgId,
      ownerProfileId: owner.profileId,
    });

    if (scopeKindRaw && !isScopeKind(scopeKindRaw)) {
      return NextResponse.json(
        { success: false, message: 'Invalid scopeKind.' },
        { status: 400 },
      );
    }

    const query = owner.supabase
      .from('notification_preference_scopes')
      .select('*')
      .eq('org_id', orgId)
      .eq('profile_id', profileId)
      .is('deleted_at', null);

    if (scopeKindRaw) {
      query.eq('scope_kind', scopeKindRaw);
    }
    if (scopeId) {
      query.eq('scope_id', scopeId);
    }

    const response = await query
      .order('scope_kind', { ascending: true })
      .order('scope_id', { ascending: true })
      .order('pref_key', { ascending: true })
      .returns<NotificationPreferenceScopeRow[]>();

    if (response.error) {
      return NextResponse.json(
        { success: false, message: response.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: (response.data ?? []).map((row) => ({
        id: row.id,
        orgId: row.org_id,
        profileId: row.profile_id,
        scopeKind: row.scope_kind,
        scopeId: row.scope_id,
        prefKey: row.pref_key,
        channels: row.channels ?? [],
        muted: row.muted ?? null,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as UpsertNotificationPreferenceInput;
  const scopeKind = body.scopeKind;
  const scopeId = body.scopeId;

  if (
    !body.orgId ||
    !body.profileId ||
    !body.prefKey ||
    !scopeKind ||
    !scopeId ||
    !Array.isArray(body.channels)
  ) {
    return NextResponse.json(
      { success: false, message: 'Missing required fields.' },
      { status: 400 },
    );
  }

  if (!isScopeKind(scopeKind)) {
    return NextResponse.json(
      { success: false, message: 'Invalid scopeKind.' },
      { status: 400 },
    );
  }

  try {
    const owner = await requireOwnerContext();
    enforceOwnerScope({
      requestedOrgId: body.orgId,
      requestedProfileId: body.profileId,
      ownerOrgId: owner.orgId,
      ownerProfileId: owner.profileId,
    });

    const now = new Date().toISOString();
    const response = await owner.supabase
      .from('notification_preference_scopes')
      .upsert(
        {
          org_id: body.orgId,
          profile_id: body.profileId,
          scope_kind: scopeKind,
          scope_id: scopeId,
          pref_key: body.prefKey,
          channels: body.channels,
          muted:
            typeof body.muted === 'boolean'
              ? body.muted
              : body.channels.length === 0
                ? true
                : null,
          updated_at: now,
          updated_by: owner.profileId,
          deleted_at: null,
          deleted_by: null,
        },
        { onConflict: 'org_id,profile_id,scope_kind,scope_id,pref_key' },
      )
      .select('*')
      .single<NotificationPreferenceScopeRow>();

    if (response.error) {
      return NextResponse.json(
        { success: false, message: response.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: response.data.id,
        orgId: response.data.org_id,
        profileId: response.data.profile_id,
        scopeKind: response.data.scope_kind,
        scopeId: response.data.scope_id,
        prefKey: response.data.pref_key,
        channels: response.data.channels ?? [],
        muted: response.data.muted ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as DeleteNotificationPreferenceInput;
  const scopeKind = body.scopeKind;
  const scopeId = body.scopeId;

  if (!body.orgId || !body.profileId || !body.prefKey || !scopeKind || !scopeId) {
    return NextResponse.json(
      { success: false, message: 'Missing required fields.' },
      { status: 400 },
    );
  }

  if (!isScopeKind(scopeKind)) {
    return NextResponse.json(
      { success: false, message: 'Invalid scopeKind.' },
      { status: 400 },
    );
  }

  try {
    const owner = await requireOwnerContext();
    enforceOwnerScope({
      requestedOrgId: body.orgId,
      requestedProfileId: body.profileId,
      ownerOrgId: owner.orgId,
      ownerProfileId: owner.profileId,
    });

    const response = await owner.supabase
      .from('notification_preference_scopes')
      .delete()
      .eq('org_id', body.orgId)
      .eq('profile_id', body.profileId)
      .eq('scope_kind', scopeKind)
      .eq('scope_id', scopeId)
      .eq('pref_key', body.prefKey)
      .select('id')
      .returns<Array<{ id: string }>>();

    if (response.error) {
      return NextResponse.json(
        { success: false, message: response.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      deletedCount: response.data?.length ?? 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
