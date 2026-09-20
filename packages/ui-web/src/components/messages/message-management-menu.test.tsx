/* @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MessageVM } from '@iconicedu/shared-types';
import { MessageManagementMenu } from './message-management-menu';

function makeMessage(senderId: string): MessageVM {
  return {
    ids: { id: 'message-1', orgId: 'org-1' },
    core: {
      type: 'text',
      createdAt: '2026-01-01T00:00:00.000Z',
      visibility: { type: 'all' },
      sender: { ids: { id: senderId, orgId: 'org-1', accountId: 'account-1' } },
    },
    social: { reactions: [] },
    state: { isSaved: false },
    content: { text: 'hello' },
  } as unknown as MessageVM;
}

describe('MessageManagementMenu edit action', () => {
  it('shows "Edit message" when onEdit is provided for the sender', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(
      <MessageManagementMenu
        message={makeMessage('profile-1')}
        currentUserId="profile-1"
        onEdit={onEdit}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    const editItem = await screen.findByText('Edit message');
    await user.click(editItem);

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('does not show "Edit message" when onEdit is not provided (ineligible)', async () => {
    const user = userEvent.setup();

    render(
      <MessageManagementMenu
        message={makeMessage('profile-1')}
        currentUserId="profile-1"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'More actions' }));

    expect(screen.queryByText('Edit message')).not.toBeInTheDocument();
  });

  it('never shows "Edit message" for another user\'s message, even if onEdit is passed', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(
      <MessageManagementMenu
        message={makeMessage('someone-else')}
        currentUserId="profile-1"
        onEdit={onEdit}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'More actions' }));

    expect(screen.queryByText('Edit message')).not.toBeInTheDocument();
  });
});
