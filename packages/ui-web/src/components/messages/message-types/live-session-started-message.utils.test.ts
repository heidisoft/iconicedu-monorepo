import { describe, expect, it } from 'vitest';
import type { LiveSessionStartedMessageVM } from '@iconicedu/shared-types';

import {
  getLiveSessionStartedMessageState,
  isLiveSessionJoinDisabled,
} from './live-session-started-message.utils';

const baseMessage: LiveSessionStartedMessageVM = {
  ids: { id: 'message-1', orgId: 'org-1' },
  core: {
    type: 'live-session-started',
    sender: {
      ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
      kind: 'staff',
      profile: {
        displayName: 'Taylor Reed',
        fullName: 'Taylor Reed',
        shortName: 'Taylor',
        bio: null,
        avatar: { url: null, seed: null },
      },
      prefs: {},
      meta: {
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    },
    createdAt: '2026-01-01T10:00:00.000Z',
    visibility: { type: 'all' },
  },
  social: { reactions: [] },
  liveSession: {
    sessionId: 'session-1',
    provider: 'daily',
    title: 'Class started',
    joinUrl: '/iconic-academy/live-sessions/session-1',
    startedByProfileId: 'profile-1',
    startedByDisplayName: 'Taylor Reed',
    startedAt: '2026-01-01T10:00:00.000Z',
    endsAt: null,
    occurrenceKey: null,
    occurrenceLabel: null,
    status: 'live',
  },
};

describe('live-session-started-message.utils', () => {
  it('disables join after the default 30 minute window when no schedule end is available', () => {
    expect(
      isLiveSessionJoinDisabled(baseMessage, Date.parse('2026-01-01T10:31:00.000Z')),
    ).toBe(true);
  });

  it('uses the scheduled occurrence end time when available', () => {
    const message: LiveSessionStartedMessageVM = {
      ...baseMessage,
      liveSession: {
        ...baseMessage.liveSession,
        endsAt: '2026-01-01T11:00:00.000Z',
      },
    };

    expect(
      isLiveSessionJoinDisabled(message, Date.parse('2026-01-01T10:45:00.000Z')),
    ).toBe(false);
    expect(
      isLiveSessionJoinDisabled(message, Date.parse('2026-01-01T11:01:00.000Z')),
    ).toBe(true);
  });

  it('marks the message as class ended when joining is disabled', () => {
    expect(
      getLiveSessionStartedMessageState(
        baseMessage,
        Date.parse('2026-01-01T10:31:00.000Z'),
      ),
    ).toEqual({
      ended: true,
      title: 'Class ended',
      buttonLabel: 'Class ended',
      buttonClassName: 'border-border/70 bg-muted text-muted-foreground',
    });
  });
});
