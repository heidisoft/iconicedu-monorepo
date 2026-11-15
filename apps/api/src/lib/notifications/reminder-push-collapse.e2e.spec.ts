/**
 * Pipeline-level coverage for reminder push collapsing (#247 phase 1).
 *
 * RemindersService publishes `reminderDedupeKey` on the `session.reminder.sent`
 * activity payload (pinned in reminders.service.spec.ts). This test starts from
 * that activity event and runs the real downstream pipeline:
 *
 *   NotificationService.prepareForActivityEvent
 *     -> enqueue_event_pipeline_job('notification.deliver', payload)   [captured]
 *   NotificationService.deliver(job with that exact payload)
 *     -> sendPushNotification (real)
 *     -> POST https://exp.host/--/api/v2/push/send                     [captured]
 *
 * Only Supabase, the preference decision engine, and `fetch` are stubbed, so a
 * regression anywhere in the hand-off (payload spread, job payload shape,
 * metadata construction, collapse resolution) fails here.
 */
import { NotificationService } from '@iconicedu/api/modules/events/notification.service';
import { buildReminderPushCollapseId } from '@iconicedu/api/lib/notifications/push-collapse';

type Row = Record<string, unknown>;

const mockState: {
  tables: Record<string, Row[]>;
  enqueued: Array<{ p_job_kind: string; p_payload: Record<string, unknown> }>;
} = { tables: {}, enqueued: [] };

function mockQuery(table: string) {
  const filters: Array<(row: Row) => boolean> = [];
  const result = () => {
    const data = (mockState.tables[table] ?? []).filter((row) =>
      filters.every((filter) => filter(row)),
    );
    return { data, error: null };
  };
  const query: Record<string, unknown> = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return query;
    },
    in: (column: string, values: unknown[]) => {
      filters.push((row) => values.includes(row[column]));
      return query;
    },
    is: (column: string, value: unknown) => {
      filters.push((row) => (row[column] ?? null) === value);
      return query;
    },
    neq: () => query,
    lt: () => query,
    gt: () => query,
    gte: () => query,
    lte: () => query,
    order: () => query,
    limit: () => query,
    returns: () => query,
    update: () => query,
    maybeSingle: async () => ({ data: result().data[0] ?? null, error: null }),
    single: async () => ({ data: result().data[0] ?? null, error: null }),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result()).then(resolve, reject),
  };
  return query;
}

function mockClient() {
  return {
    from: (table: string) => mockQuery(table),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'enqueue_event_pipeline_job') {
        mockState.enqueued.push(args as (typeof mockState.enqueued)[number]);
        return { data: { id: `job-${mockState.enqueued.length}` }, error: null };
      }
      return { data: null, error: null };
    },
  };
}

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: () => mockClient(),
}));

// Preference / quiet-hours evaluation is covered elsewhere; here every
// recipient gets an immediate push so the hand-off itself is what's tested.
jest.mock('@iconicedu/api/lib/notifications/decision-engine', () => ({
  buildNotificationDecision: jest.fn(async ({ event, recipientProfileId }) => ({
    eventId: event.id,
    recipientProfileId,
    prefKey: event.event_type,
    shouldWriteInbox: true,
    deliveryChannels: ['push'],
    deliveryTiming: 'immediate',
    runAt: '2026-05-05T12:00:00.000Z',
    reasonCodes: [],
    scopeKind: 'learning_space',
    scopeId: 'space-1',
  })),
}));

jest.mock('@iconicedu/api/lib/notifications/providers/email-provider', () => ({
  sendEmailNotification: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/notifications/providers/sms-provider', () => ({
  sendSmsNotification: jest.fn(),
}));

const fetchMock = jest.fn();
const originalFetch = global.fetch;

function reminderEvent(id: string, dedupeKey: string | undefined, offset = 30): Row {
  return {
    id,
    org_id: 'org-1',
    event_type: 'session.reminder.sent',
    occurred_at: '2030-03-06T09:30:00.000Z',
    source_kind: 'system',
    scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
    deleted_at: null,
    created_by: null,
    // The shape RemindersService publishes (see reminders.service.spec.ts).
    payload: {
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
      scheduleId: 'schedule-1',
      occurrenceStart: '2030-03-06T10:00:00.000Z',
      reminderOffsetMinutes: offset,
      title: 'Algebra',
      learningSpaceTitle: 'Algebra',
      channelRouteKind: 'space',
      ...(dedupeKey ? { reminderDedupeKey: dedupeKey } : {}),
    },
  };
}

function seed(events: Row[]) {
  mockState.enqueued = [];
  mockState.tables = {
    activity_events: events,
    profiles: [
      {
        id: 'profile-1',
        account_id: 'account-1',
        org_id: 'org-1',
        timezone: 'America/New_York',
        deleted_at: null,
      },
    ],
    push_tokens: [
      {
        id: 'token-1',
        token: 'ExponentPushToken[device-1]',
        profile_id: 'profile-1',
        revoked_at: null,
      },
    ],
    channel_read_state: [],
  };
}

async function runPipeline(eventId: string) {
  const service = new NotificationService();
  const supabase = mockClient() as never;

  await service.prepareForActivityEvent({
    supabase,
    eventId,
    recipientProfileIds: ['profile-1'],
  });

  const deliverJob = mockState.enqueued.find(
    (job) => job.p_job_kind === 'notification.deliver',
  );
  expect(deliverJob).toBeDefined();

  fetchMock.mockClear();
  await service.deliver({
    supabase,
    job: { id: 'deliver-1', org_id: 'org-1', payload: deliverJob!.p_payload } as never,
  });

  const expoCall = fetchMock.mock.calls.find(
    ([url]) => url === 'https://exp.host/--/api/v2/push/send',
  );
  expect(expoCall).toBeDefined();
  return {
    deliverPayload: deliverJob!.p_payload,
    messages: JSON.parse(expoCall![1].body as string) as Array<Record<string, unknown>>,
  };
}

describe('reminder push collapsing (pipeline e2e)', () => {
  beforeEach(() => {
    global.fetch = fetchMock as never;
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn(async () => ({ data: [{ status: 'ok', id: 'ticket-1' }] })),
    });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  const dedupeKey =
    'session.reminder:org-1:space-1:channel-1:2030-03-06T10:00:00.000Z:30';

  it('carries the reminder dedupe key from the activity event to the Expo request', async () => {
    seed([reminderEvent('event-1', dedupeKey)]);

    const { deliverPayload, messages } = await runPipeline('event-1');

    // Hand-off 1: prepare copies the activity payload into the deliver job.
    expect(deliverPayload.rawEventPayload).toEqual(
      expect.objectContaining({ reminderDedupeKey: dedupeKey }),
    );
    // Hand-off 2: deliver -> push provider -> Expo body.
    const expectedId = buildReminderPushCollapseId(dedupeKey);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      to: 'ExponentPushToken[device-1]',
      collapseId: expectedId,
      tag: expectedId,
    });
    expect(String(expectedId).length).toBeLessThanOrEqual(64);
  });

  it('gives a repeat send of the same reminder the same collapse id', async () => {
    seed([reminderEvent('event-1', dedupeKey), reminderEvent('event-2', dedupeKey)]);

    const first = await runPipeline('event-1');
    mockState.enqueued = [];
    const second = await runPipeline('event-2');

    expect(second.messages[0]?.collapseId).toBe(first.messages[0]?.collapseId);
    expect(second.messages[0]?.tag).toBe(first.messages[0]?.tag);
  });

  it('keeps different reminders (e.g. 30-minute vs 15-minute) in separate tray slots', async () => {
    const fifteenKey =
      'session.reminder:org-1:space-1:channel-1:2030-03-06T10:00:00.000Z:15';
    seed([
      reminderEvent('event-30', dedupeKey, 30),
      reminderEvent('event-15', fifteenKey, 15),
    ]);

    const thirty = await runPipeline('event-30');
    mockState.enqueued = [];
    const fifteen = await runPipeline('event-15');

    expect(fifteen.messages[0]?.collapseId).not.toBe(thirty.messages[0]?.collapseId);
    // The 15-minute reminder also keeps its existing high priority.
    expect(fifteen.messages[0]).toHaveProperty('priority', 'high');
  });

  it('does not collapse reminders published before this change (no dedupe key)', async () => {
    seed([reminderEvent('event-legacy', undefined)]);

    const { messages } = await runPipeline('event-legacy');

    expect(messages[0]).not.toHaveProperty('collapseId');
    expect(messages[0]).not.toHaveProperty('tag');
  });
});
