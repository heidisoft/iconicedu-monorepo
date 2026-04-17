import { DEFAULT_NOTIFICATION_ROUTE, NOTIFICATION_REGISTRY } from './notification-config';

describe('NOTIFICATION_REGISTRY', () => {
  it('routes dm.posted with a channelId to the DM screen', () => {
    const route = NOTIFICATION_REGISTRY['dm.posted'].getRoute({
      channelId: 'channel-123',
    });
    expect(route).toBe('/(app)/dm/channel-123');
  });

  it('routes dm.posted without a channelId to the Messages tab', () => {
    const route = NOTIFICATION_REGISTRY['dm.posted'].getRoute({});
    expect(route).toBe('/(app)/(tabs)/messages');
  });

  it('keeps message.posted routing to the Inbox tab', () => {
    const route = NOTIFICATION_REGISTRY['message.posted'].getRoute({});
    expect(route).toBe('/(app)/(tabs)/inbox');
  });

  it('falls back to DEFAULT_NOTIFICATION_ROUTE for unknown prefKeys', () => {
    expect(DEFAULT_NOTIFICATION_ROUTE).toBe('/(app)/(tabs)/inbox');
  });
});
