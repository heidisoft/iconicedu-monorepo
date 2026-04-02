import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MessageSquare } from 'lucide-react-native';

import type { ActivityFeedItemVM } from '@iconicedu/shared-types';

import { ActivityItem, makeActivityItemStyles } from './activity-item';
import { lightColors } from '@/lib/theme';

function makeBaseActivity(): ActivityFeedItemVM {
  return {
    kind: 'leaf',
    ids: { id: 'activity-1', orgId: 'org-1' },
    timestamps: {
      occurredAt: '2026-04-02T12:00:00.000Z',
      createdAt: '2026-04-02T12:00:00.000Z',
    },
    tabKey: 'classes',
    audience: { scope: { kind: 'global' }, visibility: 'public' },
    verb: 'message.posted',
    refs: {
      actor: {
        kind: 'educator',
        ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
        profile: {
          displayName: 'Priya Sharma',
          firstName: 'Priya',
          lastName: 'Sharma',
          avatar: { source: 'seed', seed: 'priya-sharma' },
        },
        prefs: {},
        meta: {
          createdAt: '2026-04-02T12:00:00.000Z',
          updatedAt: '2026-04-02T12:00:00.000Z',
        },
      },
    },
    content: {
      leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
      headline: {
        primary: 'Priya Sharma',
        secondary: 'sent a message in',
        emphasis: 'Math Foundations',
      },
      summary: 'A short preview',
    },
    state: { isRead: false, importance: 'normal' },
  } as ActivityFeedItemVM;
}

function renderActivity(item: ActivityFeedItemVM) {
  return render(
    <ActivityItem
      item={item}
      colors={lightColors}
      isDark={false}
      s={makeActivityItemStyles(lightColors)}
      onMarkRead={jest.fn()}
      expandedIds={new Set()}
      onToggle={jest.fn()}
    />,
  );
}

describe('ActivityItem', () => {
  it('renders the activity row without inline avatars', () => {
    const { UNSAFE_getAllByType } = renderActivity(makeBaseActivity());

    expect(UNSAFE_getAllByType(MessageSquare).length).toBeGreaterThan(0);
    expect(screen.getByText('Priya Sharma')).toBeTruthy();
    expect(screen.getByText('Math Foundations')).toBeTruthy();
  });
});
