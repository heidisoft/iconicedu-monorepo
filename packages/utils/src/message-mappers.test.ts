import type {
  RawMessageRow,
  RawSenderProfile,
  ReactionVM,
  ThreadVM,
} from '@iconicedu/shared-types';
import { describe, expect, it } from 'vitest';
import { buildSenderProfile, mapRowToMessageVM } from './message-mappers';

const BASE_SENDER: RawSenderProfile = {
  id: 'profile-1',
  display_name: 'Tutor One',
  first_name: 'Tutor',
  last_name: 'One',
  avatar_url: 'https://example.com/avatar.png',
  avatar_seed: 'seed-1',
  kind: 'educator',
  timezone: 'Asia/Colombo',
  ui_theme_key: 'midnight',
};

function makeRow(overrides: Partial<RawMessageRow> = {}): RawMessageRow {
  return {
    id: 'message-1',
    org_id: 'org-1',
    channel_id: 'channel-1',
    sender_profile_id: BASE_SENDER.id,
    visibility_type: 'all',
    visibility_user_ids: null,
    type: 'text',
    created_at: '2026-01-01T10:00:00.000Z',
    updated_at: '2026-01-01T10:01:00.000Z',
    thread_parent_id: null,
    sender: BASE_SENDER,
    ...overrides,
  };
}

describe('buildSenderProfile', () => {
  it('maps the selected sender fields without changing values', () => {
    expect(buildSenderProfile(BASE_SENDER, 'org-1')).toEqual({
      ids: { id: 'profile-1', orgId: 'org-1', accountId: '' },
      kind: 'educator',
      profile: {
        displayName: 'Tutor One',
        avatar: { source: 'url', url: 'https://example.com/avatar.png' },
      },
      prefs: { timezone: 'Asia/Colombo' },
      ui: { themeKey: 'midnight' },
      meta: { createdAt: '', updatedAt: '' },
    });
  });

  it('falls back from a null display name to the available name parts', () => {
    const sender = {
      ...BASE_SENDER,
      display_name: null,
      first_name: 'Ada',
      last_name: null,
      avatar_url: null,
    };

    expect(buildSenderProfile(sender, 'org-1').profile).toEqual({
      displayName: 'Ada',
      avatar: { source: 'seed', seed: 'seed-1' },
    });
  });

  it('uses stable defaults when optional sender data is absent', () => {
    const sender: RawSenderProfile = {
      id: 'profile-minimal',
      display_name: null,
      first_name: null,
      last_name: null,
      avatar_url: null,
      avatar_seed: null,
      kind: null,
    };

    expect(buildSenderProfile(sender, 'org-1')).toMatchObject({
      kind: 'educator',
      profile: {
        displayName: 'Unknown',
        avatar: { source: 'seed', seed: 'profile-minimal' },
      },
      prefs: { timezone: null },
      ui: { themeKey: null },
    });
  });

  it('preserves an explicitly empty display name and falls back for an empty avatar URL', () => {
    const sender = {
      ...BASE_SENDER,
      display_name: '',
      avatar_url: '',
    };

    expect(buildSenderProfile(sender, 'org-1').profile).toEqual({
      displayName: '',
      avatar: { source: 'seed', seed: 'seed-1' },
    });
  });
});

describe('mapRowToMessageVM', () => {
  it('maps base fields, targeted visibility, reactions, and a supplied thread', () => {
    const reactions: ReactionVM[] = [
      { emoji: '👍', count: 2, reactedByMe: true, sampleUserIds: ['profile-2'] },
    ];
    const thread: ThreadVM = {
      ids: { id: 'thread-1', orgId: 'org-1' },
      parent: { messageId: 'message-1' },
      stats: { messageCount: 3, lastReplyAt: '2026-01-01T11:00:00.000Z' },
      participants: [],
    };

    const result = mapRowToMessageVM(
      makeRow({
        visibility_type: 'specific-users',
        visibility_user_ids: ['profile-2'],
      }),
      { text: 'Hello' },
      reactions,
      thread,
    );

    expect(result).toEqual({
      ids: { id: 'message-1', orgId: 'org-1' },
      core: {
        type: 'text',
        sender: buildSenderProfile(BASE_SENDER, 'org-1'),
        createdAt: '2026-01-01T10:00:00.000Z',
        visibility: { type: 'specific-users', userIds: ['profile-2'] },
      },
      social: { reactions, thread },
      content: { text: 'Hello' },
    });
    expect(result.social.reactions).toBe(reactions);
    expect(result.social.thread).toBe(thread);
  });

  it('builds the established fallback sender when the joined profile is null', () => {
    const result = mapRowToMessageVM(
      makeRow({ sender: null, sender_profile_id: 'missing-profile' }),
      null,
      [],
    );

    expect(result.core.sender).toMatchObject({
      ids: { id: 'missing-profile', orgId: 'org-1', accountId: '' },
      kind: 'educator',
      profile: {
        displayName: 'Unknown',
        avatar: { source: 'seed', seed: 'missing-profile' },
      },
    });
    expect((result as { content: { text: string } }).content.text).toBe('');
  });

  const payloadCases: Array<{
    type: string;
    property: string;
  }> = [
    { type: 'lesson-assignment', property: 'assignment' },
    { type: 'homework-submission', property: 'homework' },
    { type: 'progress-update', property: 'progress' },
    { type: 'event-reminder', property: 'event' },
    { type: 'session-summary', property: 'session' },
    { type: 'session-complete', property: 'session' },
    { type: 'session-booking', property: 'booking' },
    { type: 'payment-reminder', property: 'payment' },
    { type: 'feedback-request', property: 'feedback' },
    { type: 'audio-recording', property: 'audio' },
  ];

  it.each(payloadCases)('maps $type payloads to $property', ({ type, property }) => {
    const payload = { text: 42, marker: `${type}-payload` };
    const result = mapRowToMessageVM(makeRow({ type }), payload, []);
    const record = result as unknown as Record<string, unknown>;

    expect(record[property]).toBe(payload);
    expect(record.content).toEqual({ text: '42' });
  });

  it.each(['image', 'file'])(
    'uses a non-empty attachments array for %s messages',
    (type) => {
      const attachments = [
        { type, url: 'https://example.com/1', name: 'one' },
        { type, url: 'https://example.com/2', name: 'two' },
      ];
      const result = mapRowToMessageVM(
        makeRow({ type }),
        { text: 'Caption', attachments },
        [],
      ) as unknown as Record<string, unknown>;

      expect(result.content).toEqual({ text: 'Caption' });
      expect(result.attachment).toBe(attachments[0]);
      expect(result.attachments).toBe(attachments);
    },
  );

  it.each(['image', 'file'])(
    'falls back to the payload object for %s messages with no attachments',
    (type) => {
      const payload = { attachments: [], url: 'https://example.com/only', name: 'only' };
      const result = mapRowToMessageVM(
        makeRow({ type }),
        payload,
        [],
      ) as unknown as Record<string, unknown>;

      expect(result.content).toBeUndefined();
      expect(result.attachment).toBe(payload);
      expect(result.attachments).toEqual([payload]);
    },
  );

  it('normalizes link strings and omits non-string optional metadata', () => {
    const result = mapRowToMessageVM(
      makeRow({ type: 'link-preview' }),
      {
        text: 42,
        url: 123,
        title: null,
        description: 456,
        imageUrl: 'https://example.com/preview.png',
        siteName: false,
        favicon: 'https://example.com/favicon.ico',
      },
      [],
    ) as unknown as Record<string, unknown>;

    expect(result.content).toEqual({ text: '42' });
    expect(result.link).toEqual({
      url: '123',
      title: '',
      description: undefined,
      imageUrl: 'https://example.com/preview.png',
      siteName: undefined,
      favicon: 'https://example.com/favicon.ico',
    });
  });

  it('omits optional content for empty link and audio captions', () => {
    const link = mapRowToMessageVM(
      makeRow({ type: 'link-preview' }),
      { text: '', url: '', title: '' },
      [],
    );
    const audio = mapRowToMessageVM(
      makeRow({ type: 'audio-recording' }),
      { url: 'audio.m4a', durationSeconds: 1 },
      [],
    );

    expect((link as unknown as Record<string, unknown>).content).toBeUndefined();
    expect((audio as unknown as Record<string, unknown>).content).toBeUndefined();
  });

  it('preserves the legacy default mapping for an unrecognized message type', () => {
    const result = mapRowToMessageVM(
      makeRow({ type: 'future-message-type' }),
      { text: 'Future content' },
      [],
    );

    expect(result.core.type).toBe('future-message-type');
    expect((result as { content: { text: string } }).content).toEqual({
      text: 'Future content',
    });
    expect(result.social).toEqual({ reactions: [] });
  });
});
