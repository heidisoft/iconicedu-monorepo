/* @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MessageVM } from '@iconicedu/shared-types';
import { MessageItem } from './message-item';

const messagesState = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock(
  '@iconicedu/ui-web/components/messages/context/messages-state-provider',
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    useOptionalMessagesState: () => messagesState.current,
  }),
);

const privateMessage = {
  ids: { id: 'private-1', orgId: 'org-1' },
  core: {
    type: 'text',
    sender: {
      ids: { id: 'parent-1', orgId: 'org-1', accountId: 'acc-parent-1' },
      kind: 'guardian',
      profile: { displayName: 'Lura H', avatar: { url: null, source: 'seed' } },
      prefs: {},
      meta: {},
      ui: { themeKey: null },
      joinedDate: '2026-01-01T00:00:00.000Z',
    },
    createdAt: '2026-01-01T10:00:00.000Z',
    visibility: { type: 'specific-users', userIds: ['parent-1', 'tutor-1'] },
  },
  social: { reactions: [] },
  content: { text: 'Note for the tutor' },
} as unknown as MessageVM;

function renderAs(currentUserId: string) {
  return render(
    <MessageItem
      message={privateMessage}
      currentUserId={currentUserId}
      onOpenThread={vi.fn()}
      onProfileClick={vi.fn()}
    />,
  );
}

describe('MessageItem private message rendering', () => {
  afterEach(() => {
    messagesState.current = undefined;
  });

  it('hides a private message from a viewer outside the audience by default', () => {
    renderAs('staff-1');
    expect(screen.queryByText('Note for the tutor')).toBeNull();
  });

  it('shows it to a staff reviewer while staff review is enabled', () => {
    messagesState.current = {
      enableStaffMessageReview: true,
      currentUserId: 'staff-1',
      channel: { collections: { participants: [] } },
    };
    renderAs('staff-1');
    expect(screen.getByText('Note for the tutor')).toBeTruthy();
  });

  it('always shows it to the audience', () => {
    renderAs('tutor-1');
    expect(screen.getByText('Note for the tutor')).toBeTruthy();
  });
});
