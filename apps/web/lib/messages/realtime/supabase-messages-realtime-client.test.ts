import { describe, expect, it, vi, beforeEach } from 'vitest';

import { createSupabaseMessagesRealtimeClient } from './supabase-messages-realtime-client';

const channelOn = vi.fn();
const channelSend = vi.fn().mockResolvedValue(undefined);
const channelSubscribe = vi.fn();
const channelUnsubscribe = vi.fn();

const channel = {
  on: channelOn,
  send: channelSend,
  subscribe: channelSubscribe,
  unsubscribe: channelUnsubscribe,
};

const supabase = {
  channel: vi.fn(() => channel),
};

vi.mock('@iconicedu/web/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => supabase,
}));

describe('createSupabaseMessagesRealtimeClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('emits typing events from broadcasts', () => {
    const client = createSupabaseMessagesRealtimeClient();
    const onEvent = vi.fn();

    client.subscribe({ orgId: 'org-1', channelId: 'channel-1', onEvent });

    const typingHandler = channelOn.mock.calls.find(
      (call) => call[0] === 'broadcast' && call[1]?.event === 'typing',
    )?.[2] as ((payload: any) => void) | undefined;

    expect(typingHandler).toBeTypeOf('function');

    typingHandler?.({ payload: { profileId: 'profile-1', isTyping: true } });

    expect(onEvent).toHaveBeenCalledWith({
      type: 'typing-start',
      profileId: 'profile-1',
    });
  });

  it('sends typing broadcasts on demand', async () => {
    const client = createSupabaseMessagesRealtimeClient();

    client.subscribe({
      orgId: 'org-1',
      channelId: 'channel-1',
      onEvent: vi.fn(),
    });

    await client.sendTyping?.({
      orgId: 'org-1',
      channelId: 'channel-1',
      profileId: 'profile-2',
      isTyping: false,
    });

    expect(channelSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'broadcast',
        event: 'typing',
        payload: { profileId: 'profile-2', isTyping: false },
      }),
    );
  });

  it('emits message-deleted when a message is soft deleted', () => {
    const client = createSupabaseMessagesRealtimeClient();
    const onEvent = vi.fn();

    client.subscribe({ orgId: 'org-1', channelId: 'channel-1', onEvent });

    const messagesHandler = channelOn.mock.calls.find(
      (call) => call[0] === 'postgres_changes' && call[1]?.table === 'messages',
    )?.[2] as ((payload: any) => void) | undefined;

    expect(messagesHandler).toBeTypeOf('function');

    messagesHandler?.({
      eventType: 'UPDATE',
      new: { id: 'message-1', deleted_at: '2026-02-16T00:00:00.000Z' },
      old: null,
    });

    expect(onEvent).toHaveBeenCalledWith({
      type: 'message-deleted',
      messageId: 'message-1',
    });
  });

  it('emits message-deleted when update detail fetch returns 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
      })),
    );

    const client = createSupabaseMessagesRealtimeClient();
    const onEvent = vi.fn();
    client.subscribe({ orgId: 'org-1', channelId: 'channel-1', onEvent });

    const messagesHandler = channelOn.mock.calls.find(
      (call) => call[0] === 'postgres_changes' && call[1]?.table === 'messages',
    )?.[2] as ((payload: any) => void) | undefined;

    expect(messagesHandler).toBeTypeOf('function');

    messagesHandler?.({
      eventType: 'UPDATE',
      new: null,
      old: { id: 'message-2' },
    });

    await vi.waitFor(() => {
      expect(onEvent).toHaveBeenCalledWith({
        type: 'message-deleted',
        messageId: 'message-2',
      });
    });
  });

  it('refetches a message if another event arrives while the first fetch is pending', async () => {
    let resolveFirstFetch: ((value: unknown) => void) | null = null;
    const firstFetchPromise = new Promise((resolve) => {
      resolveFirstFetch = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => firstFetchPromise)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: {
            ids: { id: 'parent-1' },
            social: { thread: { ids: { id: 'thread-1' } } },
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const onEvent = vi.fn();
    const client = createSupabaseMessagesRealtimeClient();
    client.subscribe({ orgId: 'org-1', channelId: 'channel-1', onEvent });

    const threadHandler = channelOn.mock.calls.find(
      (call) => call[0] === 'postgres_changes' && call[1]?.table === 'threads',
    )?.[2] as ((payload: any) => void) | undefined;
    const messageHandler = channelOn.mock.calls.find(
      (call) => call[0] === 'postgres_changes' && call[1]?.table === 'messages',
    )?.[2] as ((payload: any) => void) | undefined;

    expect(threadHandler).toBeTypeOf('function');
    expect(messageHandler).toBeTypeOf('function');

    threadHandler?.({
      eventType: 'INSERT',
      new: { parent_message_id: 'parent-1' },
      old: null,
    });
    messageHandler?.({
      eventType: 'UPDATE',
      new: { id: 'parent-1' },
      old: null,
    });

    resolveFirstFetch?.({
      ok: true,
      json: async () => ({
        success: true,
        message: {
          ids: { id: 'parent-1' },
          social: {},
        },
      }),
    });

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'message-updated',
        message: expect.objectContaining({
          ids: expect.objectContaining({ id: 'parent-1' }),
          social: expect.objectContaining({
            thread: expect.objectContaining({ ids: expect.objectContaining({ id: 'thread-1' }) }),
          }),
        }),
      }),
    );
  });
});
