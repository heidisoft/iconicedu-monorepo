/* @vitest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageBase } from '@iconicedu/ui-web/components/messages/message-base';

const messagesState = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock(
  '@iconicedu/ui-web/components/messages/context/messages-state-provider',
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    useOptionalMessagesState: () => messagesState.current,
  }),
);
import type { MessageVM, ThreadVM } from '@iconicedu/shared-types';

const baseMessage: MessageVM = {
  ids: { id: 'message-1', orgId: 'org-1' },
  core: {
    type: 'text',
    sender: {
      ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
      kind: 'guardian',
      profile: {
        displayName: 'User 1',
        avatar: { url: null, source: 'seed' },
      },
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
};

function renderMessageBase(
  props: Partial<React.ComponentProps<typeof MessageBase>> = {},
) {
  return render(
    <MessageBase
      message={baseMessage}
      onOpenThread={vi.fn() as unknown as (thread: ThreadVM, message: MessageVM) => void}
      onProfileClick={vi.fn()}
      onToggleSaved={vi.fn()}
      onToggleHidden={vi.fn()}
      onDelete={vi.fn()}
      {...props}
    >
      <span>Hello</span>
    </MessageBase>,
  );
}

describe('MessageBase grouped management actions', () => {
  it('keeps save and more actions available for grouped feed messages', () => {
    renderMessageBase({
      messageUiThemeKey: 'feed',
      feedGroupPosition: 'middle',
    });

    expect(screen.getByRole('button', { name: 'Save message' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument();
  });

  it('keeps save and more actions available for grouped classic messages', () => {
    renderMessageBase({
      messageUiThemeKey: 'classic',
      feedGroupPosition: 'last',
    });

    expect(screen.getByRole('button', { name: 'Save message' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument();
  });
});

describe('MessageBase chat bubbles', () => {
  it('places feed actions below the bubble without hover-only positioning', () => {
    renderMessageBase({ messageUiThemeKey: 'feed', feedGroupPosition: 'single' });
    const reply = screen.getByRole('button', { name: 'Reply' });
    expect(reply.closest('[class~="group/message-bubble"]')).toBeNull();
    expect(reply.parentElement).toHaveClass('min-h-[34px]');
    expect(reply.parentElement).not.toHaveClass('absolute', 'opacity-0');
    expect(
      screen.getByRole('button', { name: 'Add emoji' }).parentElement,
    ).toBeInTheDocument();
  });

  it.each([
    {
      currentUserId: 'profile-1',
      surface: 'bg-chat-bubble-own',
      alignment: 'justify-end',
    },
    {
      currentUserId: 'profile-2',
      surface: 'bg-chat-bubble-other',
      alignment: 'justify-start',
    },
  ])(
    'distinguishes $surface messages in channels and threads',
    ({ currentUserId, surface, alignment }) => {
      const { container, rerender } = renderMessageBase({ currentUserId });

      expect(screen.getByText('Hello').parentElement).toHaveClass(
        surface,
        'rounded-[12px]',
        'px-3',
        'py-2',
      );
      expect(container.querySelector('[data-message-id]')).toHaveClass(alignment);

      rerender(
        <MessageBase
          message={baseMessage}
          currentUserId={currentUserId}
          isThreadReply
          feedGroupPosition="last"
          onOpenThread={vi.fn()}
          onProfileClick={vi.fn()}
        >
          <span>Hello</span>
        </MessageBase>,
      );

      expect(screen.getByText('Hello').parentElement).toHaveClass(surface);
      expect(container.querySelector('[data-message-id]')).toHaveClass(alignment);
    },
  );

  it.each([
    { currentUserId: 'profile-1', surface: 'bg-feed-bubble-own' },
    { currentUserId: 'profile-2', surface: 'bg-feed-bubble-other' },
  ])('matches mobile feed bubbles for $surface', ({ currentUserId, surface }) => {
    renderMessageBase({
      currentUserId,
      messageUiThemeKey: 'feed',
      feedGroupPosition: 'middle',
    });

    expect(screen.getByText('Hello').parentElement).toHaveClass(
      surface,
      'w-full',
      'rounded-[12px]',
      'px-3',
      'py-2',
    );
    expect(screen.getByText('Hello').parentElement).not.toHaveClass(
      'border',
      'bg-muted/45',
    );
  });
});

describe('MessageBase staff review of private messages', () => {
  beforeEach(() => {
    messagesState.current = { enableStaffMessageReview: true };
  });
  afterEach(() => {
    messagesState.current = undefined;
  });

  const privateMessage: MessageVM = {
    ...baseMessage,
    core: {
      ...baseMessage.core,
      visibility: { type: 'specific-users', userIds: ['profile-1', 'parent-1'] },
    },
  };

  it('is read-only for a viewer outside the audience', () => {
    renderMessageBase({
      message: privateMessage,
      currentUserId: 'staff-1',
      messageUiThemeKey: 'feed',
      feedGroupPosition: 'single',
    });
    expect(screen.getByRole('button', { name: 'Reply' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add emoji' })).toBeDisabled();
  });

  it.each(['parent-1', 'profile-1'])('stays interactive for audience member %s', (id) => {
    renderMessageBase({
      message: privateMessage,
      currentUserId: id,
      messageUiThemeKey: 'feed',
      feedGroupPosition: 'single',
    });
    expect(screen.getByRole('button', { name: 'Reply' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add emoji' })).toBeEnabled();
  });

  it('leaves private messages interactive while staff review is flagged off', () => {
    messagesState.current = { enableStaffMessageReview: false };
    renderMessageBase({
      message: privateMessage,
      currentUserId: 'staff-1',
      messageUiThemeKey: 'feed',
      feedGroupPosition: 'single',
    });
    expect(screen.getByRole('button', { name: 'Reply' })).toBeEnabled();
  });

  it('keeps everyone messages interactive for staff', () => {
    renderMessageBase({
      currentUserId: 'staff-1',
      messageUiThemeKey: 'feed',
      feedGroupPosition: 'single',
    });
    expect(screen.getByRole('button', { name: 'Reply' })).toBeEnabled();
  });
});
