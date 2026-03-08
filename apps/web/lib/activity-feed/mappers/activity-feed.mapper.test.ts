import { describe, expect, it } from 'vitest';

import { mapActivityFeedItemRow } from '@iconicedu/web/lib/activity-feed/mappers/activity-feed.mapper';

describe('mapActivityFeedItemRow', () => {
  it('uses actor avatar/theme when content leading is icon', () => {
    const mapped = mapActivityFeedItemRow(
      {
        id: 'item-1',
        org_id: 'org-1',
        recipient_profile_id: 'profile-1',
        kind: 'leaf',
        occurred_at: '2026-03-08T10:00:00.000Z',
        created_at: '2026-03-08T10:00:00.000Z',
        tab_key: 'classes',
        audience: { scope: { kind: 'learning_space', learningSpaceId: 'space-1' } },
        verb: 'class.updated',
        actor_profile_id: 'actor-1',
        content: {
          headline: { primary: 'Learning space updated' },
          leading: { kind: 'icon', iconKey: 'GraduationCap', tone: 'neutral' },
        },
        updated_at: '2026-03-08T10:00:00.000Z',
      },
      {
        actor: {
          ids: { id: 'actor-1', orgId: 'org-1', accountId: 'account-1' },
          kind: 'system',
          profile: {
            displayName: 'Priya Shah',
            avatar: { source: 'upload', url: 'https://cdn.test/priya.png' },
          },
          prefs: {},
          meta: {
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-03-01T00:00:00.000Z',
          },
          ui: { themeKey: 'emerald' },
        },
      },
    );

    expect(mapped.content.leading).toEqual({
      kind: 'avatars',
      avatars: [
        {
          name: 'Priya Shah',
          avatar: { source: 'upload', url: 'https://cdn.test/priya.png' },
          themeKey: 'emerald',
        },
      ],
      overflowCount: 0,
    });
  });

  it('keeps explicit avatars leading unchanged', () => {
    const mapped = mapActivityFeedItemRow(
      {
        id: 'item-2',
        org_id: 'org-1',
        recipient_profile_id: 'profile-1',
        kind: 'leaf',
        occurred_at: '2026-03-08T10:00:00.000Z',
        created_at: '2026-03-08T10:00:00.000Z',
        tab_key: 'classes',
        audience: { scope: { kind: 'learning_space', learningSpaceId: 'space-1' } },
        verb: 'member.invited',
        actor_profile_id: 'actor-1',
        content: {
          headline: { primary: 'Tehara invited to the learning space' },
          leading: {
            kind: 'avatars',
            avatars: [
              {
                name: 'Tehara Morgan',
                avatar: { source: 'upload', url: 'https://cdn.test/tehara.png' },
                themeKey: 'rose',
              },
            ],
            overflowCount: 0,
          },
        },
        updated_at: '2026-03-08T10:00:00.000Z',
      },
      {
        actor: {
          ids: { id: 'actor-1', orgId: 'org-1', accountId: 'account-1' },
          kind: 'system',
          profile: {
            displayName: 'Priya Shah',
            avatar: { source: 'seed', seed: 'actor-1' },
          },
          prefs: {},
          meta: {
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-03-01T00:00:00.000Z',
          },
          ui: { themeKey: 'emerald' },
        },
      },
    );

    expect(mapped.content.leading).toEqual({
      kind: 'avatars',
      avatars: [
        {
          name: 'Tehara Morgan',
          avatar: { source: 'upload', url: 'https://cdn.test/tehara.png' },
          themeKey: 'rose',
        },
      ],
      overflowCount: 0,
    });
  });
});
