import { describe, expect, it } from 'vitest';
import type { UserProfileVM } from '@iconicedu/shared-types';

import {
  buildMessageTextSegments,
  extractMentionsFromMessageText,
} from './message-mentions.utils';

function createParticipant(overrides: Partial<UserProfileVM> & { ids?: Partial<UserProfileVM['ids']> } = {}) {
  return {
    kind: 'guardian',
    ids: {
      id: 'user-1',
      orgId: 'org-1',
      accountId: 'account-1',
      ...(overrides.ids ?? {}),
    },
    profile: {
      displayName: 'Alex Johnson',
      firstName: 'Alex',
      lastName: 'Johnson',
      avatar: null,
      ...(overrides.profile ?? {}),
    },
    prefs: {},
    meta: {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    ...(overrides as Omit<UserProfileVM, 'ids' | 'profile'>),
  } as UserProfileVM;
}

describe('message mention utils', () => {
  it('extracts exact participant mentions and excludes the current user', () => {
    const self = createParticipant({ ids: { id: 'self' }, profile: { displayName: 'Alex Johnson' } });
    const other = createParticipant({ ids: { id: 'other' }, profile: { displayName: 'Taylor Reed' } });

    expect(
      extractMentionsFromMessageText('Hello @Taylor Reed and @Alex Johnson', [self, other], 'self'),
    ).toEqual([
      {
        profileId: 'other',
        displayName: 'Taylor Reed',
        start: 6,
        end: 18,
      },
    ]);
  });

  it('splits text into normal and mention segments', () => {
    expect(
      buildMessageTextSegments('Hi @Taylor Reed there', [
        { profileId: 'other', displayName: 'Taylor Reed', start: 3, end: 15 },
      ]),
    ).toEqual([
      { type: 'text', text: 'Hi ' },
      {
        type: 'mention',
        mention: { profileId: 'other', displayName: 'Taylor Reed', start: 3, end: 15 },
      },
      { type: 'text', text: ' there' },
    ]);
  });
});
