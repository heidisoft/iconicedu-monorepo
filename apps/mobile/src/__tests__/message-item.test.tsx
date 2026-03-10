import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MessageItem } from '@/components/messages/message-item';
import type { MessageVM } from '@iconicedu/shared-types';
import { lightColors as LIGHT } from '@/lib/theme';

const sender = {
  kind: 'educator',
  ids: { id: 'user-1', orgId: 'org-1', accountId: 'acc-1' },
  profile: {
    displayName: 'John Doe',
    avatar: {
      source: 'seed' as const,
      seed: 'john',
      url: null,
      updatedAt: '2025-01-01T00:00:00Z',
    },
  },
  prefs: {},
  meta: { createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
} as unknown as MessageVM['core']['sender'];

const baseMessage: MessageVM = {
  ids: { id: 'msg-1', orgId: 'org-1' },
  core: {
    type: 'text',
    sender,
    createdAt: '2025-01-15T10:30:00Z',
    visibility: { type: 'all' },
  },
  social: { reactions: [] },
  state: {},
  content: { text: 'Hello world' },
} as unknown as MessageVM;

const colors = LIGHT;

describe('MessageItem', () => {
  it('renders text message content', () => {
    render(
      <MessageItem message={baseMessage} isOwn={false} isGroupStart colors={colors} />,
    );
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('renders sender name when isGroupStart is true', () => {
    render(
      <MessageItem message={baseMessage} isOwn={false} isGroupStart colors={colors} />,
    );
    expect(screen.getByText('John Doe')).toBeTruthy();
  });

  it('hides sender name when isGroupStart is false', () => {
    render(
      <MessageItem
        message={baseMessage}
        isOwn={false}
        isGroupStart={false}
        colors={colors}
      />,
    );
    expect(screen.queryByText('John Doe')).toBeNull();
  });

  it('renders own message without bubble style', () => {
    render(<MessageItem message={baseMessage} isOwn isGroupStart colors={colors} />);
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('renders audio message waveform', () => {
    const audioMsg = {
      ...baseMessage,
      core: { ...baseMessage.core, type: 'audio-recording' },
      audio: { durationSeconds: 65, waveform: [0.5, 0.8, 0.3] },
    } as unknown as MessageVM;
    render(<MessageItem message={audioMsg} isOwn={false} isGroupStart colors={colors} />);
    // Duration should show 1:05
    expect(screen.getByText('1:05')).toBeTruthy();
  });
});
