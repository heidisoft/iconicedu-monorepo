import type { SupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';

jest.mock('@iconicedu/api/lib/activity-feed/activity-verb-suppression', () => ({
  resolveActivityVerbSuppressionDecision: jest.fn(async () => ({
    shouldPublish: true,
  })),
}));

function makeQuery(result: unknown) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    is: jest.fn(() => query),
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    single: jest.fn(async () => result),
    maybeSingle: jest.fn(async () => result),
  };
  return query;
}

describe('publishActivityEvent', () => {
  it('refreshes existing deduped events when requested', async () => {
    const insertQuery = makeQuery({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    });
    const updateResult = {
      id: 'event-1',
      org_id: 'org-1',
      event_type: 'class.session.canceled',
      occurred_at: '2026-05-05T12:00:00.000Z',
      source_kind: 'system',
      actor_profile_id: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: null,
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: { canceledReason: 'weather', orgSlug: 'academy' },
      audience_rules: [],
      dedupe_key: 'session.canceled:exception-1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-05-05T12:00:00.000Z',
      updated_at: '2026-05-05T12:00:00.000Z',
    };
    const updateQuery = makeQuery({ data: updateResult, error: null });
    const orgQuery = makeQuery({ data: { slug: 'academy' }, error: null });
    const from = jest
      .fn()
      .mockReturnValueOnce(orgQuery)
      .mockReturnValueOnce(insertQuery)
      .mockReturnValueOnce(updateQuery);
    const rpc = jest.fn(async () => ({ data: 'job-1', error: null }));
    const supabase = { from, rpc } as unknown as SupabaseServiceClient;

    const result = await publishActivityEvent({
      supabase,
      orgId: 'org-1',
      eventType: 'class.session.canceled',
      occurredAt: '2026-05-05T12:00:00.000Z',
      sourceKind: 'system',
      actorProfileId: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      targetRef: { kind: 'learning_space', id: 'space-1' },
      payload: { canceledReason: 'weather' },
      dedupeKey: 'session.canceled:exception-1',
      refreshOnDedupe: true,
      createdBy: 'profile-1',
    });

    expect(result).toEqual(updateResult);
    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { canceledReason: 'weather', orgSlug: 'academy' },
        projection_status: 'pending',
        last_projection_error: null,
      }),
    );
    expect(rpc).toHaveBeenCalledWith(
      'enqueue_event_pipeline_job',
      expect.objectContaining({
        p_job_kind: 'activity.project',
        p_source_id: 'event-1',
      }),
    );
  });
});
