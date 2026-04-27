import type {
  NotificationDeliveryChannel,
  NotificationPolicyConfig,
} from '@iconicedu/shared-types';

import { getActivityEventDefinition } from '@iconicedu/api/lib/activity-feed/definitions/activity-definitions';

const FALLBACK_DEFAULT_CHANNELS: NotificationDeliveryChannel[] = ['push', 'email'];

function resolveDefaultDelaySeconds(input: {
  timing?: 'immediate' | 'standard' | 'digest';
  critical: boolean;
}) {
  if (input.critical || input.timing === 'immediate') {
    return 0;
  }
  if (input.timing === 'standard') {
    return 60;
  }
  return 120;
}

export function getNotificationDefinition(eventType: string) {
  return getActivityEventDefinition(eventType)?.notification;
}

export function getNotificationPreferenceKey(eventType: string) {
  return getNotificationDefinition(eventType)?.prefKey ?? eventType;
}

export function getNotificationDefaultChannels(
  eventType: string,
): NotificationDeliveryChannel[] {
  return (
    getNotificationDefinition(eventType)?.defaultChannels ?? FALLBACK_DEFAULT_CHANNELS
  );
}

export function getNotificationPolicyConfig(eventType: string): NotificationPolicyConfig {
  const notification = getNotificationDefinition(eventType);
  const critical = notification?.isCritical === true;
  const timing = notification?.timing;
  const digestEligible = timing === 'digest';

  return {
    prefKey: notification?.prefKey ?? eventType,
    critical,
    presenceAware: notification?.presenceAware ?? true,
    digestEligible: !critical && digestEligible,
    defaultDelaySeconds: resolveDefaultDelaySeconds({ timing, critical }),
  };
}
