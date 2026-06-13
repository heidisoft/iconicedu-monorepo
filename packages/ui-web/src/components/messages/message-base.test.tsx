/* @vitest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MessageBase } from '@iconicedu/ui-web/components/messages/message-base';
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
