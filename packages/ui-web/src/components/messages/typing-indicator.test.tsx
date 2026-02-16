import React from 'react';
import { render, screen } from '@testing-library/react';

import { TypingIndicator } from './typing-indicator';
import type { UserProfileVM } from '@iconicedu/shared-types';

const makeProfile = (id: string, name: string): UserProfileVM =>
  ({
    ids: { id, orgId: 'org-1', accountId: `account-${id}` },
    kind: 'guardian',
    profile: {
      displayName: name,
      avatar: { url: null, source: 'seed' },
    },
    prefs: {},
    meta: {},
    ui: { themeKey: null },
    joinedDate: new Date().toISOString(),
  } as unknown as UserProfileVM);

describe('TypingIndicator', () => {
  it('renders nothing when no profiles', () => {
    const { container } = render(<TypingIndicator profiles={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a single name with animated dots', () => {
    render(<TypingIndicator profiles={[makeProfile('p1', 'Ava')]} />);
    expect(screen.getAllByText(/Ava is typing/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('status')).toBeInTheDocument();
    // Verify animated dots are present (there should be 3 dots)
    const container = screen.getByRole('status');
    const dots = container.querySelectorAll('span[class*="animate"]');
    expect(dots.length).toBe(3);
  });

  it('renders multiple names summary with animated dots', () => {
    render(
      <TypingIndicator
        profiles={[
          makeProfile('p1', 'Ava'),
          makeProfile('p2', 'Kai'),
          makeProfile('p3', 'Mia'),
        ]}
      />,
    );
    expect(
      screen.getAllByText(/Ava, Kai, and 1 other are typing/i).length,
    ).toBeGreaterThan(0);
    // Verify animated dots are present
    const container = screen.getByRole('status');
    const dots = container.querySelectorAll('span[class*="animate"]');
    expect(dots.length).toBe(3);
  });

  it('deduplicates repeated typing profiles', () => {
    render(
      <TypingIndicator
        profiles={[
          makeProfile('p1', 'Ava'),
          makeProfile('p1', 'Ava'),
          makeProfile('p2', 'Kai'),
        ]}
      />,
    );

    expect(screen.getAllByText(/Ava and Kai are typing/i).length).toBeGreaterThan(0);
  });
});
