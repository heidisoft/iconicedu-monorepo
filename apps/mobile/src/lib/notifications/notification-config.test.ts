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

  it('routes session.reminder.sent with a channelId to the class space', () => {
    const route = NOTIFICATION_REGISTRY['session.reminder.sent'].getRoute({
      channelId: 'ch-1',
    });
    expect(route).toBe('/(app)/spaces/ch-1');
  });

  it('routes session.reminder.sent without a channelId to the schedule tab', () => {
    const route = NOTIFICATION_REGISTRY['session.reminder.sent'].getRoute({});
    expect(route).toBe('/(app)/(tabs)/schedule');
  });

  it('routes session.feedback_request.sent with a channelId to the class space', () => {
    const route = NOTIFICATION_REGISTRY['session.feedback_request.sent'].getRoute({
      channelId: 'ch-1',
    });
    expect(route).toBe('/(app)/spaces/ch-1');
  });

  it('routes session.feedback_request.sent without a channelId to the schedule tab', () => {
    const route = NOTIFICATION_REGISTRY['session.feedback_request.sent'].getRoute({});
    expect(route).toBe('/(app)/(tabs)/schedule');
  });

  it('falls back to DEFAULT_NOTIFICATION_ROUTE for unknown prefKeys', () => {
    expect(DEFAULT_NOTIFICATION_ROUTE).toBe('/(app)/(tabs)/inbox');
  });
});
