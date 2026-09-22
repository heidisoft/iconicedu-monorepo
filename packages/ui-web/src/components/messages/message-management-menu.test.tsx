/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MessageManagementMenu } from './message-management-menu';
import type { MessageVM } from '@iconicedu/shared-types';

// Radix's DropdownMenu relies on pointer-event/portal behavior jsdom does not
// implement, so — matching this repo's established pattern (see
// components/sidebar/nav-user.test.tsx) — render its content unconditionally
// and turn each item into a plain button.
vi.mock('@iconicedu/ui-web/ui/dropdown-menu', () => {
  const passthrough = ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement('div', props, children);
  return {
    DropdownMenu: passthrough,
    DropdownMenuTrigger: ({ children }: { children?: React.ReactNode }) => children,
    DropdownMenuContent: passthrough,
    DropdownMenuSeparator: () => React.createElement('hr'),
    DropdownMenuItem: ({
      children,
      onSelect,
      disabled,
      ...props
    }: {
      children?: React.ReactNode;
      onSelect?: (event: Event) => void;
      disabled?: boolean;
    }) =>
      React.createElement(
        'button',
        {
          ...props,
          type: 'button',
          disabled,
          onClick: () => {
            if (disabled) return;
            onSelect?.({ preventDefault: () => undefined } as unknown as Event);
          },
        },
        children,
      ),
  };
});

const baseMessage: MessageVM = {
  ids: { id: 'message-1', orgId: 'org-1' },
  core: {
    type: 'text',
    sender: {
      ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
      kind: 'guardian',
      profile: { displayName: 'User 1', avatar: { url: null, source: 'seed' } },
      prefs: {},
      meta: {},
      ui: { themeKey: null },
      joinedDate: '2026-02-16T10:00:00.000Z',
    },
    createdAt: '2026-02-16T10:00:00.000Z',
    visibility: { type: 'all' },
  },
  social: { reactions: [] },
  content: { text: 'Hello' },
} as unknown as MessageVM;

describe('MessageManagementMenu pinning', () => {
  it('does not show a pin action when canPinMessages is false (flag off, or non-manager)', () => {
    render(<MessageManagementMenu message={baseMessage} currentUserId="someone-else" />);
    expect(screen.queryByText('Pin message')).not.toBeInTheDocument();
    expect(screen.queryByText('Unpin message')).not.toBeInTheDocument();
  });

  it('shows "Pin message" when canPinMessages is true and the message is not pinned', () => {
    render(
      <MessageManagementMenu
        message={baseMessage}
        currentUserId="someone-else"
        canPinMessages
        isPinned={false}
      />,
    );
    expect(screen.getByText('Pin message')).toBeInTheDocument();
  });

  it('shows "Unpin message" when the message is already pinned', () => {
    render(
      <MessageManagementMenu
        message={baseMessage}
        currentUserId="someone-else"
        canPinMessages
        isPinned
      />,
    );
    expect(screen.getByText('Unpin message')).toBeInTheDocument();
  });

  it('calls onTogglePinned when the pin action is selected', () => {
    const onTogglePinned = vi.fn();
    render(
      <MessageManagementMenu
        message={baseMessage}
        currentUserId="someone-else"
        canPinMessages
        isPinned={false}
        onTogglePinned={onTogglePinned}
      />,
    );
    fireEvent.click(screen.getByText('Pin message'));
    expect(onTogglePinned).toHaveBeenCalledTimes(1);
  });

  it('disables the pin action while isPinning is true, and it does not fire onTogglePinned', () => {
    const onTogglePinned = vi.fn();
    render(
      <MessageManagementMenu
        message={baseMessage}
        currentUserId="someone-else"
        canPinMessages
        isPinned={false}
        isPinning
        onTogglePinned={onTogglePinned}
      />,
    );
    const button = screen.getByRole('button', { name: /pin message/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onTogglePinned).not.toHaveBeenCalled();
  });
});
