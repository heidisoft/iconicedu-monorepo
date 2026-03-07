import { describe, expect, it } from 'vitest';
import type { UserProfileVM } from '@iconicedu/shared-types';

import { buildOptimisticComposerMessage } from './messages-container';

const sender = {
  kind: 'guardian',
  ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
  profile: { displayName: 'Alex' },
  prefs: {},
  meta: {},
} as unknown as UserProfileVM;

describe('buildOptimisticComposerMessage', () => {
  it('builds a text message when no assignment metadata is provided', () => {
    const message = buildOptimisticComposerMessage({
      orgId: 'org-1',
      sender,
      content: 'hello',
    });

    expect(message.core.type).toBe('text');
    expect(message.content.text).toBe('hello');
  });

  it('builds a lesson-assignment message when assignment metadata is provided', () => {
    const message = buildOptimisticComposerMessage({
      orgId: 'org-1',
      sender,
      content: 'Please complete this.',
      homework: {
        kind: 'homework',
        title: 'Fractions Practice Set',
        description: 'Focus on equivalent fractions',
        dueAt: '2026-03-11T12:00:00.000Z',
        subject: 'Math',
      },
    });

    expect(message.core.type).toBe('lesson-assignment');
    if (!('assignment' in message)) {
      throw new Error('Expected assignment payload');
    }
    expect(message.assignment).toMatchObject({
      kind: 'homework',
      title: 'Fractions Practice Set',
      description: 'Focus on equivalent fractions',
      dueAt: '2026-03-11T12:00:00.000Z',
      subject: 'Math',
    });
  });
});
