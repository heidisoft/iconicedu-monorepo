export type NotificationConfig = {
  /** Display label in the notification preferences UI */
  label: string;
  /**
   * Returns the Expo Router path to push when a notification is tapped.
   * `scopeKind` and `scopeId` come from the push payload (Gap 7 web enrichment).
   * When absent, returns the tab-level fallback route.
   */
  getRoute: (data: {
    scopeKind?: string;
    scopeId?: string;
    channelId?: string;
    threadId?: string | null;
    channelRouteKind?: string;
  }) => string;
};

export const NOTIFICATION_REGISTRY: Record<string, NotificationConfig> = {
  'class.session.rescheduled': {
    label: 'Session Rescheduled',
    getRoute: ({ channelId }) =>
      channelId ? `/(app)/spaces/${channelId}?tab=sessions` : '/(app)/(tabs)/schedule',
  },
  'class.sessions.rescheduled': {
    label: 'Sessions Rescheduled',
    getRoute: ({ channelId }) =>
      channelId ? `/(app)/spaces/${channelId}?tab=sessions` : '/(app)/(tabs)/schedule',
  },
  'class.session.canceled': {
    label: 'Session Cancelled',
    getRoute: ({ channelId }) =>
      channelId ? `/(app)/spaces/${channelId}?tab=sessions` : '/(app)/(tabs)/schedule',
  },
  'class.sessions.canceled': {
    label: 'Sessions Cancelled',
    getRoute: ({ channelId }) =>
      channelId ? `/(app)/spaces/${channelId}?tab=sessions` : '/(app)/(tabs)/schedule',
  },
  'message.posted': {
    label: 'New Messages',
    getRoute: ({ scopeKind, scopeId, channelId, threadId }) => {
      const targetId = channelId ?? scopeId;
      if (!targetId) return '/(app)/(tabs)/inbox';
      const base =
        scopeKind === 'learning_space'
          ? `/(app)/spaces/${targetId}`
          : `/(app)/channel/${targetId}`;
      return threadId ? `${base}?threadId=${threadId}` : base;
    },
  },
  'dm.posted': {
    label: 'Direct Messages',
    getRoute: ({ channelId, scopeId }) =>
      channelId
        ? `/(app)/dm/${channelId}`
        : scopeId
          ? `/(app)/dm/${scopeId}`
          : '/(app)/(tabs)/messages',
  },
  'session.reminder.sent': {
    label: 'Session Reminders',
    getRoute: ({ channelId }) =>
      channelId ? `/(app)/spaces/${channelId}` : '/(app)/(tabs)/schedule',
  },
  'session.feedback_request.sent': {
    label: 'Session Feedback',
    getRoute: ({ channelId }) =>
      channelId ? `/(app)/spaces/${channelId}` : '/(app)/(tabs)/schedule',
  },
  'reaction.added': {
    label: 'Reactions',
    getRoute: ({ scopeKind, scopeId, channelId, channelRouteKind }) => {
      const targetId = channelId ?? scopeId;
      if (!targetId) return '/(app)/(tabs)/inbox';
      if (channelRouteKind === 'dm') {
        return `/(app)/dm/${targetId}`;
      }
      return scopeKind === 'learning_space'
        ? `/(app)/spaces/${targetId}`
        : `/(app)/channel/${targetId}`;
    },
  },
  'payment.reminder': {
    label: 'Payment Reminder',
    getRoute: () => '/(app)/(tabs)/inbox',
  },
  'payment.reminder.sent': {
    label: 'Payment Reminder',
    getRoute: () => '/(app)/(tabs)/inbox',
  },
};

export const DEFAULT_NOTIFICATION_ROUTE = '/(app)/(tabs)/inbox';
