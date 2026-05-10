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

const messageNotificationConfig: NotificationConfig = {
  label: 'New Messages',
  getRoute: ({ scopeKind, scopeId, channelId, threadId, channelRouteKind }) => {
    const targetId = channelId ?? scopeId;
    if (!targetId) return '/(app)/(tabs)/messages';
    const base =
      channelRouteKind === 'dm'
        ? `/(app)/dm/${targetId}`
        : scopeKind === 'learning_space'
          ? `/(app)/spaces/${targetId}`
          : `/(app)/channel/${targetId}`;
    return threadId ? `${base}?threadId=${threadId}` : base;
  },
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
      if (channelRouteKind === 'dm') {
        return `/(app)/dm/${targetId}`;
      }
      return scopeKind === 'learning_space'
        ? `/(app)/spaces/${targetId}`
        : `/(app)/channel/${targetId}`;
    },
  },
};

export const DEFAULT_NOTIFICATION_ROUTE = '/(app)/(tabs)/inbox';
