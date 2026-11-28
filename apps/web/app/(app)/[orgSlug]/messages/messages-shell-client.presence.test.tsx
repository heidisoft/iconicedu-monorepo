import React from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChannelVM, UserProfileVM } from '@iconicedu/shared-types';
import { MessagesShellClient } from './messages-shell-client';

const mocks = vi.hoisted(() => ({
  on: vi.fn(),
  subscribe: vi.fn(),
  track: vi.fn(),
  untrack: vi.fn(),
  unsubscribe: vi.fn(),
  presenceState: vi.fn(),
  channel: vi.fn(),
  shell: vi.fn(),
}));
vi.mock('@iconicedu/ui-web', () => ({
  MessagesShell: (props: { channel: ChannelVM }) => {
    mocks.shell(props);
    return null;
  },
}));
vi.mock(
  '@iconicedu/ui-web/components/messages/external-live-session-join-dialog',
  () => ({ ExternalLiveSessionJoinDialog: () => null }),
);
vi.mock('@iconicedu/web/components/live-sessions/use-live-session-navigation', () => ({
  useLiveSessionNavigation: () => ({
    externalJoinTarget: null,
    closeExternalJoinDialog: vi.fn(),
    handleResolvedJoinHref: vi.fn(),
  }),
}));
vi.mock('@iconicedu/web/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ channel: mocks.channel }),
}));
vi.mock('@iconicedu/web/lib/messages/realtime/supabase-messages-realtime-client', () => ({
  createSupabaseMessagesRealtimeClient: () => ({ subscribe: vi.fn() }),
}));

const profile = (id: string) =>
  ({
    ids: { id, orgId: 'org-1', accountId: id },
    kind: 'staff',
    profile: { displayName: id },
    presence: null,
  }) as unknown as UserProfileVM;
const initial = {
  ids: { id: 'channel-1', orgId: 'org-1' },
  collections: { participants: [profile('sender'), profile('reader')] },
} as unknown as ChannelVM;
const props = {
  orgSlug: 'test',
  currentUserId: 'sender',
  sendTextMessage: vi.fn(),
  sendFileMessage: vi.fn(),
  sendFilesMessage: vi.fn(),
  editTextMessage: vi.fn(),
  toggleReaction: vi.fn(),
  toggleSavedMessage: vi.fn(),
  deleteMessage: vi.fn(),
  toggleHiddenMessage: vi.fn(),
};

describe('channel presence subscription lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const channel = {
      on: mocks.on,
      subscribe: mocks.subscribe,
      track: mocks.track,
      untrack: mocks.untrack,
      unsubscribe: mocks.unsubscribe,
      presenceState: mocks.presenceState,
    };
    mocks.channel.mockReturnValue(channel);
    mocks.on.mockReturnValue(channel);
    mocks.presenceState.mockReturnValue({ reader: [{ profile_id: 'reader' }] });
    mocks.track.mockResolvedValue(undefined);
    mocks.untrack.mockResolvedValue(undefined);
    mocks.unsubscribe.mockResolvedValue(undefined);
  });
  it('updates online status without leaving and rejoining the channel', () => {
    const view = render(<MessagesShellClient {...props} channel={initial} />);
    const sync = mocks.on.mock.calls.find(
      ([kind, filter]) => kind === 'presence' && filter.event === 'sync',
    )![2];
    act(() => sync());
    const current = mocks.shell.mock.calls.at(-1)![0].channel as ChannelVM;
    expect(current.collections.participants[1].presence?.displayStatus).toBe('online');
    expect(mocks.channel).toHaveBeenCalledTimes(1);
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
    act(() => sync());
    expect(mocks.channel).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(mocks.untrack).toHaveBeenCalledTimes(1);
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });
  it('ignores reordering and profile edits but resubscribes when membership changes', () => {
    const view = render(<MessagesShellClient {...props} channel={initial} />);
    const updated = {
      ...initial,
      collections: {
        ...initial.collections,
        participants: [...initial.collections.participants].reverse().map((person) => ({
          ...person,
          profile: { ...person.profile, displayName: 'Updated' },
        })),
      },
    };
    view.rerender(<MessagesShellClient {...props} channel={updated} />);
    expect(mocks.channel).toHaveBeenCalledTimes(1);
    const changed = {
      ...updated,
      collections: {
        ...updated.collections,
        participants: [...updated.collections.participants, profile('new-member')],
      },
    };
    view.rerender(<MessagesShellClient {...props} channel={changed} />);
    expect(mocks.channel).toHaveBeenCalledTimes(2);
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
    view.unmount();
  });
  it('cleans up on identity/channel changes and does not subscribe to an empty membership', () => {
    const view = render(<MessagesShellClient {...props} channel={initial} />);
    view.rerender(
      <MessagesShellClient {...props} currentUserId="reader" channel={initial} />,
    );
    expect(mocks.channel).toHaveBeenCalledTimes(2);
    const changed = { ...initial, ids: { ...initial.ids, id: 'channel-2' } };
    view.rerender(
      <MessagesShellClient {...props} currentUserId="reader" channel={changed} />,
    );
    expect(mocks.channel).toHaveBeenLastCalledWith('messages-presence:org-1:channel-2');
    view.rerender(
      <MessagesShellClient
        {...props}
        channel={{
          ...changed,
          collections: { ...changed.collections, participants: [] },
        }}
      />,
    );
    const count = mocks.channel.mock.calls.length;
    view.unmount();
    expect(mocks.channel).toHaveBeenCalledTimes(count);
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(count);
  });
});
