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
  }) => string;
};

export const NOTIFICATION_REGISTRY: Record<string, NotificationConfig> = {
  'message.posted': {
    label: 'New Messages',
    getRoute: () => '/(app)/(tabs)/inbox',
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
  'homework.assigned': {
    label: 'Homework Assigned',
    getRoute: () => '/(app)/(tabs)/home',
  },
  'homework.submitted': {
    label: 'Homework Submitted',
    getRoute: () => '/(app)/(tabs)/home',
  },
  'homework.reviewed': {
    label: 'Homework Reviewed',
    getRoute: () => '/(app)/(tabs)/home',
  },
  'class.session.scheduled': {
    label: 'Session Scheduled',
    getRoute: () => '/(app)/(tabs)/schedule',
  },
  'class.session.rescheduled': {
    label: 'Session Rescheduled',
    getRoute: () => '/(app)/(tabs)/schedule',
  },
  'class.session.canceled': {
    label: 'Session Cancelled',
    getRoute: () => '/(app)/(tabs)/schedule',
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
  'class.created': {
    label: 'New Class',
    getRoute: () => '/(app)/(tabs)/home',
  },
  'member.joined': {
    label: 'Member Joined',
    getRoute: () => '/(app)/(tabs)/inbox',
  },
  'member.invited': {
    label: 'Invitations',
    getRoute: () => '/(app)/(tabs)/inbox',
  },
  'summary.posted': {
    label: 'AI Summary',
    getRoute: ({ scopeKind, scopeId, channelId }) =>
      scopeKind === 'channel' && scopeId
        ? `/(app)/spaces/${scopeId}`
        : scopeKind === 'learning_space' && channelId
          ? `/(app)/spaces/${channelId}`
          : '/(app)/(tabs)/inbox',
  },
  'file.uploaded': {
    label: 'File Uploaded',
    getRoute: ({ scopeKind, scopeId, channelId }) =>
      scopeKind === 'channel' && scopeId
        ? `/(app)/spaces/${scopeId}`
        : scopeKind === 'learning_space' && channelId
          ? `/(app)/spaces/${channelId}`
          : '/(app)/(tabs)/inbox',
  },
};

export const DEFAULT_NOTIFICATION_ROUTE = '/(app)/(tabs)/inbox';
