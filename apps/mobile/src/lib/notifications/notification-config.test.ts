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

  it('routes message.posted to a channel screen', () => {
    const route = NOTIFICATION_REGISTRY['message.posted'].getRoute({
      scopeKind: 'channel',
      channelId: 'channel-456',
    });
    expect(route).toBe('/(app)/channel/channel-456');
  });

  it('routes message.posted thread replies with a thread query param', () => {
    const route = NOTIFICATION_REGISTRY['message.posted'].getRoute({
      scopeKind: 'learning_space',
      channelId: 'space-123',
      threadId: 'thread-1',
    });
    expect(route).toBe('/(app)/spaces/space-123?threadId=thread-1');
  });

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

  it('routes class.sessions.rescheduled without a channelId to the schedule tab', () => {
    const route = NOTIFICATION_REGISTRY['class.sessions.rescheduled'].getRoute({});
    expect(route).toBe('/(app)/(tabs)/schedule');
  });

  it('routes class.session.rescheduled with a channelId to the classroom sessions tab', () => {
    const route = NOTIFICATION_REGISTRY['class.session.rescheduled'].getRoute({
      channelId: 'ch-2',
    });
    expect(route).toBe('/(app)/spaces/ch-2?tab=sessions');
  });

  it('routes class.session.canceled with a channelId to the classroom sessions tab', () => {
    const route = NOTIFICATION_REGISTRY['class.session.canceled'].getRoute({
      channelId: 'ch-3',
    });
    expect(route).toBe('/(app)/spaces/ch-3?tab=sessions');
  });

  it('routes class.sessions.canceled without a channelId to the schedule tab', () => {
    const route = NOTIFICATION_REGISTRY['class.sessions.canceled'].getRoute({});
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

  it('routes payment.reminder.sent to inbox', () => {
    const route = NOTIFICATION_REGISTRY['payment.reminder.sent'].getRoute({});
    expect(route).toBe('/(app)/(tabs)/inbox');
  });

  it('falls back to DEFAULT_NOTIFICATION_ROUTE for unknown prefKeys', () => {
    expect(DEFAULT_NOTIFICATION_ROUTE).toBe('/(app)/(tabs)/inbox');
  });
});
