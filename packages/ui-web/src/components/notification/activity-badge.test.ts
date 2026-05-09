import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ActivityFeedItemVM } from '@iconicedu/shared-types';
import { ActivityBadge } from './activity-badge';

function createActivity(overrides: Partial<ActivityFeedItemVM> = {}): ActivityFeedItemVM {
  return {
    kind: 'leaf',
    ids: { id: 'activity-1', orgId: 'org-1' },
    timestamps: {
      occurredAt: '2026-03-13T10:00:00.000Z',
      createdAt: '2026-03-13T10:00:00.000Z',
    },
    tabKey: 'classes',
    audience: {
      scope: { kind: 'global' },
      visibility: 'public',
    },
    verb: 'class.session.rescheduled',
    refs: {
      actor: {
        ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
        kind: 'educator',
        profile: {
          displayName: 'Priya Shah',
          avatar: { source: 'generated', seed: 'profile-1' },
        },
        prefs: {},
        meta: {
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        },
      },
    },
    content: {
      headline: {
        primary: 'Class rescheduled',
      },
    },
    ...overrides,
  };
}

describe('ActivityBadge avatar sizing', () => {
  const filename = fileURLToPath(import.meta.url);
  const source = readFileSync(resolve(dirname(filename), 'activity-badge.tsx'), 'utf8');

  it('uses the shared avatar size class for grouped and actor avatars', () => {
    expect(source).toContain("const ACTIVITY_AVATAR_SIZE_CLASS = 'size-6';");
    expect(source).toContain('const MAX_VISIBLE_ACTIVITY_AVATARS = 3;');
    expect(source).toContain('const avatars = leading.avatars.slice(');
    expect(source).toContain('MAX_VISIBLE_ACTIVITY_AVATARS');
    expect(source).toContain('enableProfilePreview={false}');
    expect(source).toContain('sizeClassName={ACTIVITY_AVATAR_SIZE_CLASS}');
    expect(source).toContain(
      "sizeClassName={cn(ACTIVITY_AVATAR_SIZE_CLASS, 'shrink-0', className)}",
    );
  });
});

describe('ActivityBadge', () => {
  it('renders the actor avatar when an actor is available', () => {
    render(React.createElement(ActivityBadge, { activity: createActivity() }));

    expect(screen.getByText('PS')).toBeInTheDocument();
  });

  it('does not crash when an activity has no actor', () => {
    const { container } = render(
      React.createElement(ActivityBadge, {
        activity: createActivity({ refs: { actor: null } }),
      }),
    );

    expect(container).toBeEmptyDOMElement();
  });
});
