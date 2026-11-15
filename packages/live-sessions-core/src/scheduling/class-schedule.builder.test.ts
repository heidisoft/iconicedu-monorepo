import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { buildClassSchedulesByIds, buildClassSchedulesByOrg } from '../index';

// This builder is the single row → ClassScheduleVM path shared by apps/api's
// GET /schedules/calendar (which backs the web calendar, channel-schedules route,
// and learning-space builder) and live-session scope resolution. These tests pin
// its output shape so the web calendar keeps rendering exactly what it did when
// apps/web assembled VMs itself.

type Call = { method: string; args: unknown[] };
type TableCall = { table: string; calls: Call[] };

function createFakeSupabase(tables: Record<string, unknown[] | { error: string }>) {
  const log: TableCall[] = [];

  const client = {
    from(table: string) {
      const entry: TableCall = { table, calls: [] };
      log.push(entry);
      const fixture = tables[table] ?? [];
      const result = Array.isArray(fixture)
        ? { data: fixture, error: null }
        : { data: null, error: { message: fixture.error } };

      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'in', 'is', 'order', 'returns']) {
        builder[method] = (...args: unknown[]) => {
          entry.calls.push({ method, args });
          return builder;
        };
      }
      builder.then = (resolve: (value: unknown) => unknown) => resolve(result);
      return builder;
    },
  };

  return { supabase: client as unknown as SupabaseClient, log };
}

function scheduleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'schedule-1',
    org_id: 'org-1',
    title: 'Algebra I',
    description: null,
    location: null,
    meeting_link: 'https://meet.example/abc',
    start_at: '2026-09-02T09:00:00.000Z',
    end_at: '2026-09-02T10:00:00.000Z',
    timezone: 'America/New_York',
    status: 'scheduled',
    visibility: 'private',
    theme_key: 'teal',
    source_kind: 'class_session',
    source_learning_space_id: 'space-1',
    source_channel_id: 'channel-1',
    source_session_id: null,
    source_owner_user_id: null,
    source_created_by_user_id: null,
    source_related_learning_space_id: null,
    created_at: '2026-08-01T00:00:00.000Z',
    created_by: 'user-1',
    updated_at: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  };
}

const participantRow = {
  id: 'participant-1',
  org_id: 'org-1',
  schedule_id: 'schedule-1',
  profile_id: 'profile-1',
  role: 'educator',
  status: 'accepted',
  display_name: 'Ada',
  avatar_url: null,
  theme_key: 'not-a-theme',
};

const recurrenceRow = {
  id: 'recurrence-1',
  org_id: 'org-1',
  schedule_id: 'schedule-1',
  frequency: 'weekly',
  interval: 1,
  count: null,
  until: '2026-12-01',
  timezone: 'America/New_York',
  byday: ['MO', 'XX', 'WE'],
};

describe('buildClassSchedulesByOrg', () => {
  it('maps schedules with participants, recurrence, exceptions, overrides, and archive metadata', async () => {
    const { supabase, log } = createFakeSupabase({
      class_schedules: [scheduleRow()],
      class_schedule_participants: [participantRow],
      class_schedule_recurrence: [recurrenceRow],
      class_schedule_recurrence_exceptions: [
        {
          id: 'ex-1',
          recurrence_id: 'recurrence-1',
          occurrence_key: '2026-09-09',
          reason: null,
        },
      ],
      class_schedule_recurrence_overrides: [
        {
          id: 'ov-1',
          recurrence_id: 'recurrence-1',
          occurrence_key: '2026-09-16',
          patch: { startAt: '2026-09-16T11:00:00.000Z' },
        },
      ],
      learning_spaces: [
        { id: 'space-1', status: 'archived', archived_at: '2026-10-01T00:00:00.000Z' },
      ],
    });

    const result = await buildClassSchedulesByOrg(supabase, 'org-1');

    expect(result).toEqual([
      {
        ids: { id: 'schedule-1', orgId: 'org-1' },
        title: 'Algebra I',
        description: null,
        location: null,
        meetingLink: 'https://meet.example/abc',
        startAt: '2026-09-02T09:00:00.000Z',
        endAt: '2026-09-02T10:00:00.000Z',
        timezone: 'America/New_York',
        status: 'scheduled',
        visibility: 'private',
        themeKey: 'teal',
        participants: [
          {
            ids: { id: 'profile-1', orgId: 'org-1' },
            role: 'educator',
            status: 'accepted',
            displayName: 'Ada',
            avatarUrl: null,
            themeKey: null,
          },
        ],
        source: {
          kind: 'class_session',
          learningSpaceId: 'space-1',
          channelId: 'channel-1',
          sessionId: undefined,
          archivedAt: '2026-10-01T00:00:00.000Z',
          learningSpaceStatus: 'archived',
        },
        recurrence: {
          ids: { id: 'recurrence-1', orgId: 'org-1' },
          rule: {
            frequency: 'weekly',
            interval: 1,
            byWeekday: ['MO', 'WE'],
            count: undefined,
            until: '2026-12-01',
            timezone: 'America/New_York',
          },
          exceptions: [{ occurrenceKey: '2026-09-09', reason: undefined }],
          overrides: [
            {
              occurrenceKey: '2026-09-16',
              patch: { startAt: '2026-09-16T11:00:00.000Z' },
            },
          ],
        },
        audit: {
          createdAt: '2026-08-01T00:00:00.000Z',
          createdBy: 'user-1',
          updatedAt: undefined,
          updatedBy: undefined,
          deletedAt: undefined,
          deletedBy: undefined,
        },
      },
    ]);

    // Org scoping and soft-delete filtering must be applied on every read.
    const schedulesCall = log.find((entry) => entry.table === 'class_schedules');
    expect(schedulesCall?.calls).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['org_id', 'org-1'] },
        { method: 'is', args: ['deleted_at', null] },
        { method: 'order', args: ['start_at', { ascending: true }] },
      ]),
    );
    for (const entry of log) {
      expect(entry.calls).toContainEqual({ method: 'eq', args: ['org_id', 'org-1'] });
    }
  });

  it('includes every source kind (the calendar shows availability blocks and manual events too)', async () => {
    const { supabase } = createFakeSupabase({
      class_schedules: [
        scheduleRow({
          id: 'block-1',
          source_kind: 'availability_block',
          source_learning_space_id: null,
          source_channel_id: null,
          source_owner_user_id: 'user-9',
        }),
        scheduleRow({
          id: 'manual-1',
          source_kind: 'manual',
          source_learning_space_id: null,
          source_channel_id: null,
          source_related_learning_space_id: 'space-7',
        }),
      ],
    });

    const result = await buildClassSchedulesByOrg(supabase, 'org-1');

    expect(result.map((schedule) => schedule.source)).toEqual([
      { kind: 'availability_block', ownerUserId: 'user-9' },
      {
        kind: 'manual',
        createdByUserId: 'user-1',
        relatedTo: { kind: 'learning_space', id: 'space-7' },
      },
    ]);
    expect(result.every((schedule) => schedule.recurrence === undefined)).toBe(true);
    expect(result.every((schedule) => schedule.participants.length === 0)).toBe(true);
  });

  it('skips child-table reads when there are no schedules', async () => {
    const { supabase, log } = createFakeSupabase({ class_schedules: [] });

    await expect(buildClassSchedulesByOrg(supabase, 'org-1')).resolves.toEqual([]);
    expect(log.map((entry) => entry.table)).toEqual(['class_schedules']);
  });

  it('degrades to an empty list when the schedules read fails', async () => {
    const { supabase } = createFakeSupabase({ class_schedules: { error: 'boom' } });

    await expect(buildClassSchedulesByOrg(supabase, 'org-1')).resolves.toEqual([]);
  });
});

describe('buildClassSchedulesByIds', () => {
  it('filters to the requested ids within the org', async () => {
    const { supabase, log } = createFakeSupabase({
      class_schedules: [scheduleRow({ source_learning_space_id: null })],
    });

    const result = await buildClassSchedulesByIds(supabase, 'org-1', ['schedule-1']);

    expect(result.map((schedule) => schedule.ids.id)).toEqual(['schedule-1']);
    expect(log[0]).toMatchObject({ table: 'class_schedules' });
    expect(log[0].calls).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['org_id', 'org-1'] },
        { method: 'in', args: ['id', ['schedule-1']] },
        { method: 'is', args: ['deleted_at', null] },
      ]),
    );
  });

  it('does not query at all for an empty id list', async () => {
    const { supabase, log } = createFakeSupabase({});

    await expect(buildClassSchedulesByIds(supabase, 'org-1', [])).resolves.toEqual([]);
    expect(log).toEqual([]);
  });
});
