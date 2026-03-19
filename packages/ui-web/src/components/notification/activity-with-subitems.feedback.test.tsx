/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivityWithSubitems } from './activity-with-subitems';
import type {
  ActivityFeedGroupItemVM,
  ActivityFeedLeafItemVM,
} from '@iconicedu/shared-types';

function createFeedbackSubActivity(
  metadata: Partial<Record<string, unknown>> = {},
): ActivityFeedLeafItemVM {
  const actor = {
    kind: 'educator',
    ids: { id: 'actor-1', orgId: 'org-1', accountId: 'account-1' },
    profile: {
      displayName: 'Educator',
      avatar: { source: 'generated', seed: 'actor-1' },
    },
  } as const;

  return {
    kind: 'leaf',
    ids: { id: 'feedback-leaf-1', orgId: 'org-1' },
    timestamps: {
      occurredAt: '2026-03-16T10:00:00.000Z',
      createdAt: '2026-03-16T10:00:00.000Z',
    },
    tabKey: 'classes',
    audience: {
      scope: { kind: 'global' },
      visibility: 'public',
    },
    verb: 'session.feedback_request.sent',
    refs: { actor: actor as never },
    content: {
      headline: {
        primary: 'Class feedback requested',
        secondary: 'How was your Algebra session today?',
      },
      summary: 'Rate this class in one minute.',
    },
    state: { isRead: false },
    metadata: {
      sourceEventId: '11111111-1111-4111-8111-111111111111',
      messageId: '22222222-2222-4222-8222-222222222222',
      classSessionId: '33333333-3333-4333-8333-333333333333',
      classroomId: '44444444-4444-4444-8444-444444444444',
      channelId: '55555555-5555-4555-8555-555555555555',
      occurrenceStart: '2026-03-16T10:00:00.000Z',
      feedbackUiEnabled: true,
      ...metadata,
    },
  };
}

function createGroupWithFeedbackSubitem(
  subItem: ActivityFeedLeafItemVM,
): ActivityFeedGroupItemVM {
  const actor = {
    kind: 'educator',
    ids: { id: 'actor-1', orgId: 'org-1', accountId: 'account-1' },
    profile: {
      displayName: 'Educator',
      avatar: { source: 'generated', seed: 'actor-1' },
    },
  } as const;

  return {
    kind: 'group',
    ids: { id: 'group-1', orgId: 'org-1' },
    timestamps: {
      occurredAt: '2026-03-16T10:00:00.000Z',
      createdAt: '2026-03-16T10:00:00.000Z',
    },
    tabKey: 'classes',
    audience: {
      scope: { kind: 'global' },
      visibility: 'public',
    },
    verb: 'session.reminder.sent',
    refs: { actor: actor as never },
    grouping: {
      groupType: 'class',
      groupKey: 'session:classroom-1',
    },
    content: {
      headline: { primary: 'Class session timeline' },
    },
    state: { isRead: false },
    subActivityCount: 1,
    subActivities: { items: [subItem], total: 1 },
  };
}

describe('ActivityWithSubitems feedback request rendering', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders inline feedback stars for grouped class feedback request subitems', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: { submittedAt: '2026-03-16T10:01:00.000Z', rating: 5, comment: null },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ActivityWithSubitems
        activity={createGroupWithFeedbackSubitem(createFeedbackSubActivity())}
        onMarkRead={() => {}}
      />,
    );

    await user.click(screen.getByText('Class session timeline'));
    expect(screen.getByRole('button', { name: 'Rate 5 stars' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Rate 3 stars' }));
    expect(
      screen.getByPlaceholderText('Tell us what could be better...'),
    ).toBeInTheDocument();
  });

  it('submits grouped 5-star feedback through the feedback API', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: { submittedAt: '2026-03-16T10:01:00.000Z', rating: 5, comment: null },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ActivityWithSubitems
        activity={createGroupWithFeedbackSubitem(createFeedbackSubActivity())}
        onMarkRead={() => {}}
      />,
    );

    await user.click(screen.getByText('Class session timeline'));
    await user.click(screen.getByRole('button', { name: 'Rate 5 stars' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/activity-feed/feedback',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
