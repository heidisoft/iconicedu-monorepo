import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireEffectiveActorContext } from '@iconicedu/web/lib/family-view/actor-context';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  let actor;
  try {
    actor = await requireEffectiveActorContext(supabase);
  } catch (error) {
    if (error instanceof Error && error.message === 'Account not found') {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    throw error;
  }

  if (!actor) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? body?.ids.filter(
        (id): id is string => typeof id === 'string' && id.length > 0 && isUuid(id),
      )
    : [];

  if (!ids.length) {
    return NextResponse.json({ updated: 0 });
  }

  const baseItemsResponse = await supabase
    .from('activity_feed_items')
    .select('id, kind')
    .eq('org_id', actor.account.org_id)
    .eq('recipient_profile_id', actor.profile.id)
    .in('id', ids)
    .is('deleted_at', null);

  if (baseItemsResponse.error) {
    return NextResponse.json({ error: baseItemsResponse.error.message }, { status: 500 });
  }

  const groupIds = (baseItemsResponse.data ?? [])
    .filter((item) => item.kind === 'group')
    .map((item) => item.id);

  const resolvedIds = new Set(ids);
  if (groupIds.length) {
    const groupMembersResponse = await supabase
      .from('activity_feed_group_members')
      .select('item_id')
      .eq('org_id', actor.account.org_id)
      .in('group_id', groupIds);

    if (groupMembersResponse.error) {
      return NextResponse.json(
        { error: groupMembersResponse.error.message },
        { status: 500 },
      );
    }

    for (const member of groupMembersResponse.data ?? []) {
      if (member.item_id) {
        resolvedIds.add(member.item_id);
      }
    }
  }

  const idsToUpdate = Array.from(resolvedIds);
  if (!idsToUpdate.length) {
    return NextResponse.json({ updated: 0 });
  }

  const now = new Date().toISOString();
  const updateResponse = await supabase
    .from('activity_feed_items')
    .update({
      is_read: true,
      read_at: now,
      updated_at: now,
      updated_by: actor.profile.id,
    })
    .eq('org_id', actor.account.org_id)
    .eq('recipient_profile_id', actor.profile.id)
    .in('id', idsToUpdate)
    .is('deleted_at', null);

  if (updateResponse.error) {
    return NextResponse.json({ error: updateResponse.error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: idsToUpdate.length });
}
