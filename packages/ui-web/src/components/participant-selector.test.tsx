import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { UserProfileVM } from '@iconicedu/shared-types';

import { ParticipantSelector } from './participant-selector';

function makeUser(overrides: Partial<UserProfileVM['profile']> = {}): UserProfileVM {
  return {
    ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
    kind: 'guardian',
    profile: {
      displayName: 'Sara Parras',
      firstName: 'Sara',
      lastName: 'Parras',
      avatar: { source: 'seed', url: null },
      ...overrides,
    },
    prefs: {},
    meta: {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    joinedDate: '2026-01-01T00:00:00.000Z',
  } as UserProfileVM;
}

describe('ParticipantSelector', () => {
  it('prefers display name when it exists', () => {
    const onUserAdd = vi.fn();
    const onUserRemove = vi.fn();

    render(
      <ParticipantSelector
        users={[]}
        selectedUsers={[makeUser()]}
        onUserAdd={onUserAdd}
        onUserRemove={onUserRemove}
      />,
    );

    expect(screen.getByText('Sara Parras')).toBeInTheDocument();
  });

  it('falls back to first name + last initial when display name is missing', () => {
    const onUserAdd = vi.fn();
    const onUserRemove = vi.fn();

    render(
      <ParticipantSelector
        users={[]}
        selectedUsers={[
          makeUser({ displayName: null, firstName: 'Maya', lastName: 'Johnson' }),
        ]}
        onUserAdd={onUserAdd}
        onUserRemove={onUserRemove}
      />,
    );

    expect(screen.getByText('Maya J.')).toBeInTheDocument();
  });
});
