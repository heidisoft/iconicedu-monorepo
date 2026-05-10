/* @vitest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ActivityItemBase } from './activity-item-base';
import type { ActivityFeedItemVM } from '@iconicedu/shared-types';

vi.mock('@iconicedu/ui-web/components/notification/activity-badge', () => ({
  ActivityBadge: () => null,
}));

vi.mock('@iconicedu/ui-web/components/notification/activity-with-button', () => ({
  ActivityWithButton: () => null,
}));

function createActivity(): ActivityFeedItemVM {
  return {
    kind: 'item',
    ids: { id: 'activity-1', orgId: 'org-1' },
    timestamps: {
      occurredAt: '2026-03-13T10:00:00.000Z',
      createdAt: '2026-03-13T10:00:00.000Z',
    },
    tabKey: 'all',
    audience: {
      scope: { kind: 'personal' },
      visibility: 'visible',
    },
    verb: 'message.posted',
    refs: {
      actor: {
        profileId: 'profile-1',
        displayName: 'Dinithi D',
      },
    },
    content: {
      headline: {
        primary: 'Dinithi D sent you a direct message',
        secondary: 'Direct message',
        secondaryHref: '../dm/channel-dm-1',
      },
      expandedContent: 'Hello there',
    },
    state: {
      isRead: false,
    },
  } as ActivityFeedItemVM;
}

describe('ActivityItemBase', () => {
  it('links the secondary headline to the conversation when secondaryHref is provided', () => {
    render(<ActivityItemBase activity={createActivity()} onMarkRead={vi.fn()} />);

    const link = screen.getByRole('link', { name: 'Direct message' });
    expect(link).toHaveAttribute('href', '../dm/channel-dm-1');
  });

  it('renders secondary headline as text when no headline link is provided', () => {
    const activity = createActivity();
    activity.content.headline.secondaryHref = undefined;

    render(<ActivityItemBase activity={activity} onMarkRead={vi.fn()} />);

    expect(screen.getByText('Direct message').tagName).toBe('SPAN');
  });

  it('renders a vertical connector when timeline connector is enabled', () => {
    const { container } = render(
      <ActivityItemBase
        activity={createActivity()}
        onMarkRead={vi.fn()}
        showTimelineConnector
      />,
    );

    expect(
      container.querySelector(
        '.absolute.left-1\\/2.top-7.hidden.h-\\[calc\\(100\\%\\+1rem\\)\\].w-px',
      ),
    ).not.toBeNull();
  });

  it('renders preview text when summary is absent', () => {
    const activity = createActivity();
    activity.content.summary = undefined;
    activity.content.preview = { text: 'Preview from projected content' };

    render(<ActivityItemBase activity={activity} onMarkRead={vi.fn()} />);

    expect(screen.getByText('Preview from projected content')).toBeInTheDocument();
  });

  it('hides preview text when summary and preview are blank', () => {
    const activity = createActivity();
    activity.content.summary = '   ';
    activity.content.preview = { text: '   ' };

    render(<ActivityItemBase activity={activity} onMarkRead={vi.fn()} />);

    expect(screen.queryByText('Preview from projected content')).not.toBeInTheDocument();
  });
});
