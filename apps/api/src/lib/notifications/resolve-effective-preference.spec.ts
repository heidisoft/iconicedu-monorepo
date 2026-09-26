import { resolveEffectivePreference } from './resolve-effective-preference';

function makeSupabaseMock(scopedRow: Record<string, unknown> | null) {
  return {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        maybeSingle: async () => {
          if (table === 'notification_preference_scopes') {
            return { data: scopedRow, error: null };
          }
          return { data: null, error: null };
        },
      };
      return chain;
    },
  } as never;
}

const baseEvent = {
  id: 'event-1',
  org_id: 'org-1',
  event_type: 'message.posted',
  scope: { kind: 'channel', channelId: 'chan-1' },
  payload: {},
} as never;

describe('resolveEffectivePreference conversation modes', () => {
  it('treats a "normal" mode row as unmuted', async () => {
    const result = await resolveEffectivePreference({
      supabase: makeSupabaseMock({ channels: ['push'], mode: 'normal' }),
      event: baseEvent,
      recipientProfileId: 'profile-1',
      defaultChannels: ['push'],
    });
    expect(result.muted).toBe(false);
    expect(result.mentionsOnly).toBe(false);
  });

  it('treats "mentions_only" mode as unmuted but mentions-gated', async () => {
    const result = await resolveEffectivePreference({
      supabase: makeSupabaseMock({ channels: ['push'], mode: 'mentions_only' }),
      event: baseEvent,
      recipientProfileId: 'profile-1',
      defaultChannels: ['push'],
    });
    expect(result.muted).toBe(false);
    expect(result.mentionsOnly).toBe(true);
  });

  it('treats "muted_until_enabled" as muted indefinitely', async () => {
    const result = await resolveEffectivePreference({
      supabase: makeSupabaseMock({ channels: ['push'], mode: 'muted_until_enabled' }),
      event: baseEvent,
      recipientProfileId: 'profile-1',
      defaultChannels: ['push'],
    });
    expect(result.muted).toBe(true);
  });

  it('treats "muted_until" as muted only while the timestamp is in the future', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();

    const stillMuted = await resolveEffectivePreference({
      supabase: makeSupabaseMock({
        channels: ['push'],
        mode: 'muted_until',
        muted_until: future,
      }),
      event: baseEvent,
      recipientProfileId: 'profile-1',
      defaultChannels: ['push'],
    });
    expect(stillMuted.muted).toBe(true);

    const expired = await resolveEffectivePreference({
      supabase: makeSupabaseMock({
        channels: ['push'],
        mode: 'muted_until',
        muted_until: past,
      }),
      event: baseEvent,
      recipientProfileId: 'profile-1',
      defaultChannels: ['push'],
    });
    expect(expired.muted).toBe(false);
  });

  it('falls back to the legacy muted boolean when mode is absent', async () => {
    const result = await resolveEffectivePreference({
      supabase: makeSupabaseMock({ channels: ['push'], muted: true }),
      event: baseEvent,
      recipientProfileId: 'profile-1',
      defaultChannels: ['push'],
    });
    expect(result.muted).toBe(true);
    expect(result.mentionsOnly).toBe(false);
  });

  it('defaults to unmuted, non-scoped when no preference rows exist', async () => {
    const result = await resolveEffectivePreference({
      supabase: makeSupabaseMock(null),
      event: baseEvent,
      recipientProfileId: 'profile-1',
      defaultChannels: ['push', 'email'],
    });
    expect(result.muted).toBe(false);
    expect(result.mentionsOnly).toBe(false);
    expect(result.channels).toEqual(['push', 'email']);
  });
});
