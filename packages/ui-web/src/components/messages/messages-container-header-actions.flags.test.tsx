/* @vitest-environment jsdom */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const baseChannel: any = {
  ids: { id: 'channel-1', orgId: 'org-1' },
  basics: {
    kind: 'channel',
    topic: 'General',
    purpose: 'general',
    visibility: 'private',
  },
  collections: { participants: [] },
  ui: {},
};

function mockMessagesState(overrides: Partial<Record<string, unknown>> = {}) {
  vi.doMock(
    '@iconicedu/ui-web/components/messages/context/messages-state-provider',
    () => ({
      useMessagesState: () => ({
        toggle: vi.fn(),
        isActive: () => false,
        channel: baseChannel,
        currentUserId: 'profile-1',
        joinLiveSession: undefined,
        enableMessagePinning: false,
        enableMessageSearch: false,
        enableScheduledSend: false,
        ...overrides,
      }),
    }),
  );
}

describe('MessagesContainerHeaderActions P2 entry points', () => {
  it('hides pin, search, and scheduled buttons when all three flags are off', async () => {
    vi.resetModules();
    mockMessagesState();
    const { MessagesContainerHeaderActions: Component } =
      await import('./messages-container-header-actions');
    render(<Component />);

    expect(screen.queryByLabelText('Pinned messages')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Search messages')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Scheduled messages')).not.toBeInTheDocument();
  });

  it('shows only the flags that are enabled', async () => {
    vi.resetModules();
    mockMessagesState({ enableMessagePinning: true, enableScheduledSend: true });
    const { MessagesContainerHeaderActions: Component } =
      await import('./messages-container-header-actions');
    render(<Component />);

    expect(screen.getByLabelText('Pinned messages')).toBeInTheDocument();
    expect(screen.getByLabelText('Scheduled messages')).toBeInTheDocument();
    expect(screen.queryByLabelText('Search messages')).not.toBeInTheDocument();
  });

  it('shows all three when all flags are on', async () => {
    vi.resetModules();
    mockMessagesState({
      enableMessagePinning: true,
      enableMessageSearch: true,
      enableScheduledSend: true,
    });
    const { MessagesContainerHeaderActions: Component } =
      await import('./messages-container-header-actions');
    render(<Component />);

    expect(screen.getByLabelText('Pinned messages')).toBeInTheDocument();
    expect(screen.getByLabelText('Search messages')).toBeInTheDocument();
    expect(screen.getByLabelText('Scheduled messages')).toBeInTheDocument();
  });
});
