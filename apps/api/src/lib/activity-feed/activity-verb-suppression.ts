import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActivityEventSuppressionRuleRow } from '@iconicedu/shared-types';

type SuppressionClient = Pick<SupabaseClient, 'from'>;

export type ActivityVerbSuppressionDecision = {
  shouldPublish: boolean;
  source: 'actor' | 'org' | 'default';
  rule?: ActivityEventSuppressionRuleRow;
};

async function selectSuppressionRule(input: {
  supabase: SuppressionClient;
  orgId: string;
  eventType: string;
  actorProfileId?: string | null;
}) {
  const query = input.supabase
    .from('activity_event_suppression_rules')
    .select('*')
    .eq('org_id', input.orgId)
    .eq('event_type', input.eventType)
    .is('deleted_at', null);

  if (input.actorProfileId) {
    query.eq('actor_profile_id', input.actorProfileId);
  } else {
    query.is('actor_profile_id', null);
  }

  const response = await query
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle<ActivityEventSuppressionRuleRow>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data ?? null;
}

export async function resolveActivityVerbSuppressionDecision(input: {
  supabase: SuppressionClient;
  orgId: string;
  eventType: string;
  actorProfileId?: string | null;
}): Promise<ActivityVerbSuppressionDecision> {
  if (input.actorProfileId) {
    const actorRule = await selectSuppressionRule({
      supabase: input.supabase,
      orgId: input.orgId,
      eventType: input.eventType,
      actorProfileId: input.actorProfileId,
    });

    if (actorRule) {
      return {
        shouldPublish: actorRule.is_enabled,
        source: 'actor',
        rule: actorRule,
      };
    }
  }

  const orgRule = await selectSuppressionRule({
    supabase: input.supabase,
    orgId: input.orgId,
    eventType: input.eventType,
    actorProfileId: null,
  });

  if (orgRule) {
    return {
      shouldPublish: orgRule.is_enabled,
      source: 'org',
      rule: orgRule,
    };
  }

  return {
    shouldPublish: true,
    source: 'default',
  };
}
