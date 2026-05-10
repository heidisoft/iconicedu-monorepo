import { DEFAULT_NOTIFICATION_ROUTE, NOTIFICATION_REGISTRY } from './notification-config';

describe('NOTIFICATION_REGISTRY', () => {
  it('routes message.posted with a DM route kind to the DM screen', () => {
    const route = NOTIFICATION_REGISTRY['message.posted'].getRoute({
      channelId: 'channel-123',
      channelRouteKind: 'dm',
    });
    expect(route).toBe('/(app)/dm/channel-123');
  });

  it('routes message.posted without a channelId to the Messages tab', () => {
    const route = NOTIFICATION_REGISTRY['message.posted'].getRoute({});
    expect(route).toBe('/(app)/(tabs)/messages');
  });

  it('routes message.posted to a channel screen', () => {
    const route = NOTIFICATION_REGISTRY['message.posted'].getRoute({
      scopeKind: 'channel',
      channelId: 'channel-456',
    });
    expect(route).toBe('/(app)/channel/channel-456');
  });

  it('routes message.thread_reply.posted with a thread query param', () => {
    const route = NOTIFICATION_REGISTRY['message.thread_reply.posted'].getRoute({
      scopeKind: 'learning_space',
      channelId: 'space-123',
      threadId: 'thread-1',
    });
    expect(route).toBe('/(app)/spaces/space-123?threadId=thread-1');
  });

  it.each(['message.mentioned', 'file.uploaded', 'image.uploaded', 'audio.uploaded'])(
    'routes %s like a message notification',
    (prefKey) => {
      const route = NOTIFICATION_REGISTRY[prefKey].getRoute({
        scopeKind: 'channel',
        channelId: 'channel-456',
      });
      expect(route).toBe('/(app)/channel/channel-456');
    },
  );

  it('routes reaction.added to the specific channel', () => {
    const route = NOTIFICATION_REGISTRY['reaction.added'].getRoute({
      scopeKind: 'channel',
      channelId: 'channel-789',
    });
    expect(route).toBe('/(app)/channel/channel-789');
  });

  it('routes reaction.added to the DM screen when the payload marks it as a DM', () => {
    const route = NOTIFICATION_REGISTRY['reaction.added'].getRoute({
      channelId: 'dm-123',
      channelRouteKind: 'dm',
    });
    expect(route).toBe('/(app)/dm/dm-123');
  });

  it('falls back to DEFAULT_NOTIFICATION_ROUTE for unknown prefKeys', () => {
    expect(DEFAULT_NOTIFICATION_ROUTE).toBe('/(app)/(tabs)/inbox');
  });
});
