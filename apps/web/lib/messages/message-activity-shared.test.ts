import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@iconicedu/api/lib/activity-feed/activity-publisher', () => ({
  publishActivityEvent: vi.fn(),
}));

import {
  publishFileMessagePostSendActivity,
  publishTextMessagePostSendActivities,
  type ActivityChannelContext,
} from '@iconicedu/api/lib/messages/message-activity';
import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';

function createBuilder(response: { data: unknown; error: { message: string } | null }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    is: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => response),
    returns: vi.fn(async () => response),
  };

  return builder;
}

function createSupabaseMock(
  responses: Record<string, Array<{ data: unknown; error: { message: string } | null }>>,
) {
  return {
    from: vi.fn((table: string) => {
      const queue = responses[table];
      if (!queue?.length) {
        throw new Error(`Unexpected table query: ${table}`);
      }
      return createBuilder(queue.shift()!);
    }),
  };
}

describe('shared message activity helper', () => {
  const publishActivityEventMock = vi.mocked(publishActivityEvent);

  beforeEach(() => {
    publishActivityEventMock.mockReset();
  });

  it('publishes dm.posted for direct messages', async () => {
    const supabase = createSupabaseMock({
      channel_members: [
        {
          data: [{ profile_id: 'recipient-1' }, { profile_id: 'sender-1' }],
          error: null,
        },
      ],
      profiles: [
        {
          data: [{ id: 'recipient-1', account_id: 'account-1' }],
          error: null,
        },
      ],
      channel_read_state: [
        {
          data: [{ account_id: 'account-1', last_read_at: '2026-04-18T09:00:00.000Z' }],
          error: null,
        },
      ],
    });
    const activityContext: ActivityChannelContext = {
      scope: { kind: 'channel', channelId: 'channel-1' },
      channelRouteKind: 'dm',
      channelTopic: 'Direct Message',
    };

    await publishTextMessagePostSendActivities({
      supabase: supabase as never,
      orgId: 'org-1',
      channelId: 'channel-1',
      senderProfileId: 'sender-1',
      senderName: 'Sender',
      messageId: 'message-1',
      content: 'hello there',
      now: '2026-04-18T10:00:00.000Z',
      activityContext,
    });

    expect(publishActivityEventMock).toHaveBeenCalledTimes(1);
    expect(publishActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'dm.posted',
        audienceRules: [{ kind: 'users_only', userIds: ['recipient-1'] }],
        payload: expect.objectContaining({
          channelId: 'channel-1',
          messageId: 'message-1',
          senderName: 'Sender',
          content: 'hello there',
          channelRouteKind: 'dm',
        }),
      }),
    );
  });

  it('publishes mention and thread reply activities without double-notifying the mention recipient', async () => {
    const supabase = createSupabaseMock({
      channel_members: [
        {
          data: [{ profile_id: 'mentioned-1' }],
          error: null,
        },
      ],
      thread_participants: [
        {
          data: [
            { profile_id: 'sender-1' },
            { profile_id: 'recipient-1' },
            { profile_id: 'mentioned-1' },
          ],
          error: null,
        },
      ],
    });
    const activityContext: ActivityChannelContext = {
      scope: { kind: 'channel', channelId: 'channel-1' },
      channelRouteKind: 'channel',
      channelTopic: 'General',
    };

    await publishTextMessagePostSendActivities({
      supabase: supabase as never,
      orgId: 'org-1',
      channelId: 'channel-1',
      senderProfileId: 'sender-1',
      senderName: 'Sender',
      messageId: 'message-2',
      content: 'thread reply',
      mentions: [
        { profileId: 'mentioned-1', displayName: 'Mentioned', start: 0, end: 10 },
      ],
      threadId: 'thread-1',
      threadReply: true,
      now: '2026-04-18T10:00:00.000Z',
      activityContext,
    });

    expect(publishActivityEventMock).toHaveBeenCalledTimes(2);
    expect(publishActivityEventMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        eventType: 'message.posted',
        scope: { kind: 'user', userId: 'mentioned-1' },
        payload: expect.objectContaining({
          mentionedProfileId: 'mentioned-1',
          threadReply: false,
        }),
      }),
    );
    expect(publishActivityEventMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        eventType: 'message.posted',
        scope: { kind: 'user', userId: 'recipient-1' },
        payload: expect.objectContaining({
          threadId: 'thread-1',
          threadReply: true,
          channelRouteKind: 'channel',
        }),
      }),
    );
  });

  it('publishes message.posted for channel file sends', async () => {
    const supabase = createSupabaseMock({});
    const activityContext: ActivityChannelContext = {
      scope: { kind: 'channel', channelId: 'channel-1' },
      channelRouteKind: 'channel',
      channelTopic: 'General',
    };

    await publishFileMessagePostSendActivity({
      supabase: supabase as never,
      orgId: 'org-1',
      channelId: 'channel-1',
      senderProfileId: 'sender-1',
      senderName: 'Sender',
      messageId: 'message-3',
      name: 'Worksheet.pdf',
      content: 'see attached',
      mimeType: 'application/pdf',
      storagePath: 'org-1/channel-1/files/sender-1/worksheet.pdf',
      fileCount: 2,
      now: '2026-04-18T10:00:00.000Z',
      activityContext,
    });

    expect(publishActivityEventMock).toHaveBeenCalledTimes(1);
    expect(publishActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'message.posted',
        payload: expect.objectContaining({
          name: 'Worksheet.pdf',
          fileCount: 2,
          storagePath: 'org-1/channel-1/files/sender-1/worksheet.pdf',
          channelRouteKind: 'channel',
        }),
      }),
    );
  });
});
