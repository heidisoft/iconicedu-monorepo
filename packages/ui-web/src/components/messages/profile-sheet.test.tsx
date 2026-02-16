import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProfileContent } from './profile-sheet';

const makeUser = () =>
  ({
    kind: 'educator',
    ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
    profile: {
      displayName: 'Sara Parras',
      avatar: { url: null, source: 'seed' },
    },
    prefs: {},
    meta: {},
    presence: {
      liveStatus: 'online',
      displayStatus: 'online',
      state: {},
    },
  }) as any;

describe('ProfileContent', () => {
  it('hides online status indicator in profile info avatar', () => {
    render(<ProfileContent user={makeUser()} />);
    expect(screen.queryByLabelText('Status: online')).not.toBeInTheDocument();
  });
});
