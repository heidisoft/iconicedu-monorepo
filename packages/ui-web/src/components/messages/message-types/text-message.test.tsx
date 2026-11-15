/* @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { TextMessageVM } from '@iconicedu/shared-types';
import { TextMessage } from './text-message';

const useOptionalMessagesState = vi.fn();

vi.mock('@iconicedu/ui-web/components/messages/context/messages-state-provider', () => ({
  useOptionalMessagesState: () => useOptionalMessagesState(),
}));

function makeMessage(overrides: Partial<TextMessageVM> = {}): TextMessageVM {
  return {
    ids: { id: 'message-1', orgId: 'org-1' },
    core: {
      type: 'text',
      createdAt: new Date().toISOString(),
      visibility: { type: 'all' },
      sender: {
        ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
        kind: 'guardian',
        profile: {
          displayName: 'Alex Sender',
          firstName: 'Alex',
          lastName: 'Sender',
          avatar: { source: 'seed', seed: 'alex' },
        },
      },
    },
    social: { reactions: [] },
    state: {},
    content: { text: 'Hello world' },
    ...overrides,
  } as unknown as TextMessageVM;
}

const baseBaseProps = {
  onOpenThread: vi.fn(),
  onProfileClick: vi.fn(),
  currentUserId: 'profile-1',
};

describe('TextMessage edit flow', () => {
  beforeEach(() => {
    useOptionalMessagesState.mockReset();
  });

  it('does not offer edit when there is no MessagesStateProvider in the tree', async () => {
    useOptionalMessagesState.mockReturnValue(null);
    const user = userEvent.setup();

    render(<TextMessage message={makeMessage()} {...baseBaseProps} />);

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.queryByText('Edit message')).not.toBeInTheDocument();
  });

  it('does not offer edit when enableMessageEdit is off', async () => {
    useOptionalMessagesState.mockReturnValue({
      currentUserId: 'profile-1',
      enableMessageEdit: false,
      channel: { collections: { participants: [] } },
      editTextMessage: vi.fn(),
    });
    const user = userEvent.setup();

    render(<TextMessage message={makeMessage()} {...baseBaseProps} />);

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.queryByText('Edit message')).not.toBeInTheDocument();
  });

  it("does not offer edit for someone else's message", async () => {
    useOptionalMessagesState.mockReturnValue({
      currentUserId: 'profile-2',
      enableMessageEdit: true,
      channel: { collections: { participants: [] } },
      editTextMessage: vi.fn(),
    });
    const user = userEvent.setup();

    render(
      <TextMessage
        message={makeMessage()}
        {...baseBaseProps}
        currentUserId="profile-2"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.queryByText('Edit message')).not.toBeInTheDocument();
  });

  it('does not offer edit once the message is outside the edit window', async () => {
    useOptionalMessagesState.mockReturnValue({
      currentUserId: 'profile-1',
      enableMessageEdit: true,
      channel: { collections: { participants: [] } },
      editTextMessage: vi.fn(),
    });
    const user = userEvent.setup();
    const oldMessage = makeMessage({
      core: {
        ...makeMessage().core,
        createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      },
    });

    render(<TextMessage message={oldMessage} {...baseBaseProps} />);

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.queryByText('Edit message')).not.toBeInTheDocument();
  });

  it('lets the sender edit within the window, saves optimistically, and calls editTextMessage', async () => {
    const editTextMessage = vi
      .fn()
      .mockResolvedValue(makeMessage({ content: { text: 'Updated text' } }));
    useOptionalMessagesState.mockReturnValue({
      currentUserId: 'profile-1',
      enableMessageEdit: true,
      channel: { collections: { participants: [] } },
      editTextMessage,
    });
    const user = userEvent.setup();

    render(<TextMessage message={makeMessage()} {...baseBaseProps} />);

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByText('Edit message'));

    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'Updated text');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Optimistic: shown immediately, before the promise resolves.
    expect(screen.getByText('Updated text')).toBeInTheDocument();

    await waitFor(() => {
      expect(editTextMessage).toHaveBeenCalledWith(
        expect.objectContaining({ messageId: 'message-1', content: 'Updated text' }),
      );
    });
  });

  it('rolls back to the previous text and shows an error when the save fails', async () => {
    const editTextMessage = vi
      .fn()
      .mockRejectedValue(new Error('The edit window has passed'));
    useOptionalMessagesState.mockReturnValue({
      currentUserId: 'profile-1',
      enableMessageEdit: true,
      channel: { collections: { participants: [] } },
      editTextMessage,
    });
    const user = userEvent.setup();

    render(<TextMessage message={makeMessage()} {...baseBaseProps} />);

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByText('Edit message'));

    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'Will fail');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('The edit window has passed')).toBeInTheDocument();
    });
    // Rolled back to the original text.
    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.queryByText('Will fail')).not.toBeInTheDocument();
  });

  it('cancel restores the original text without calling editTextMessage', async () => {
    const editTextMessage = vi.fn();
    useOptionalMessagesState.mockReturnValue({
      currentUserId: 'profile-1',
      enableMessageEdit: true,
      channel: { collections: { participants: [] } },
      editTextMessage,
    });
    const user = userEvent.setup();

    render(<TextMessage message={makeMessage()} {...baseBaseProps} />);

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByText('Edit message'));

    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'Abandoned edit');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(editTextMessage).not.toHaveBeenCalled();
  });

  it('shows an "(edited)" indicator when the message has been edited', () => {
    useOptionalMessagesState.mockReturnValue({
      currentUserId: 'profile-1',
      enableMessageEdit: true,
      channel: { collections: { participants: [] } },
      editTextMessage: vi.fn(),
    });

    render(
      <TextMessage
        message={makeMessage({ state: { isEdited: true } })}
        {...baseBaseProps}
      />,
    );

    expect(screen.getByLabelText('Edited')).toHaveTextContent('(edited)');
  });

  it('does not show an "(edited)" indicator for an unedited message', () => {
    useOptionalMessagesState.mockReturnValue({
      currentUserId: 'profile-1',
      enableMessageEdit: true,
      channel: { collections: { participants: [] } },
      editTextMessage: vi.fn(),
    });

    render(<TextMessage message={makeMessage()} {...baseBaseProps} />);

    expect(screen.queryByLabelText('Edited')).not.toBeInTheDocument();
  });
});
