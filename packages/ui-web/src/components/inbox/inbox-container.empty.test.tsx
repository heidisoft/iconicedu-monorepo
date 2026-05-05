/* @vitest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InboxContainer } from './inbox-container';

vi.mock('@iconicedu/ui-web/components/notification/activity-basic', () => ({
  ActivityBasic: () => null,
}));

vi.mock(
  '@iconicedu/ui-web/components/notification/activity-basic-with-expanded-content',
  () => ({
    ActivityBasicWithExpandedContent: () => null,
  }),
);

vi.mock('@iconicedu/ui-web/components/notification/activity-feedback-request', () => ({
  ActivityFeedbackRequest: () => null,
}));

describe('InboxContainer empty state', () => {
  it('renders a shadcn-style empty message when there are no alerts', () => {
    render(
      <InboxContainer
        feed={{
          activeTab: 'all',
          tabs: [
            { key: 'all', label: 'All' },
            { key: 'classes', label: 'Classes' },
            { key: 'payment', label: 'Payment' },
            { key: 'system', label: 'System' },
          ],
          sections: [],
          unreadCount: 0,
          nextCursor: null,
        }}
      />,
    );

    expect(screen.getByText('No alerts to display')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your inbox is clear right now. New messages, mentions, and updates will show up here.',
      ),
    ).toBeInTheDocument();
  });
});
