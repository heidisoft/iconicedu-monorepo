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
    activityFeedItemId?: string | null;
  }) => string;
};

const messageNotificationConfig: NotificationConfig = {
  label: 'New Messages',
  getRoute: ({ scopeKind, scopeId, channelId, threadId, channelRouteKind }) => {
    const targetId = channelId ?? scopeId;
    if (!targetId) return '/(app)/(tabs)/messages';
    const base =
      channelRouteKind === 'dm' || scopeKind === 'dm'
        ? `/(app)/dm/${targetId}`
        : scopeKind === 'learning_space'
          ? `/(app)/spaces/${targetId}`
          : `/(app)/channel/${targetId}`;
    return threadId ? `${base}?threadId=${threadId}` : base;
  },
};

const classNotificationConfig: NotificationConfig = {
  label: 'Class Updates',
  getRoute: ({ scopeKind, scopeId, channelId }) => {
    const targetId = channelId ?? (scopeKind === 'learning_space' ? scopeId : undefined);
    return targetId ? `/(app)/spaces/${targetId}` : '/(app)/(tabs)/inbox';
  },
};

const feedbackNotificationConfig: NotificationConfig = {
  label: 'Feedback Requests',
  getRoute: ({ activityFeedItemId }) =>
    activityFeedItemId
      ? `/(app)/(tabs)/inbox?activityId=${encodeURIComponent(activityFeedItemId)}`
      : '/(app)/(tabs)/inbox',
};

export const NOTIFICATION_REGISTRY: Record<string, NotificationConfig> = {
  'message.posted': messageNotificationConfig,
  'message.mentioned': messageNotificationConfig,
  'message.thread_reply.posted': messageNotificationConfig,
  'file.uploaded': messageNotificationConfig,
  'image.uploaded': messageNotificationConfig,
  'audio.uploaded': messageNotificationConfig,
  'reaction.added': {
    label: 'Reactions',
    getRoute: ({ scopeKind, scopeId, channelId, channelRouteKind }) => {
      const targetId = channelId ?? scopeId;
      if (!targetId) return '/(app)/(tabs)/inbox';
      if (channelRouteKind === 'dm' || scopeKind === 'dm') {
        return `/(app)/dm/${targetId}`;
      }
      return scopeKind === 'learning_space'
        ? `/(app)/spaces/${targetId}`
        : `/(app)/channel/${targetId}`;
    },
  },
  'class.schedule.created': classNotificationConfig,
  'class.schedule.ended': classNotificationConfig,
  'class.session.rescheduled': classNotificationConfig,
  'class.session.canceled': classNotificationConfig,
  'session.reminder.sent': classNotificationConfig,
  'session.feedback_request.sent': feedbackNotificationConfig,
};

export const DEFAULT_NOTIFICATION_ROUTE = '/(app)/(tabs)/inbox';
