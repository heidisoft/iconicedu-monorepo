import type { NotificationPolicyConfig } from '@iconicedu/shared-types';

const CRITICAL_PREF_KEYS = new Set<string>([
  'class.session.rescheduled',
  'class.sessions.rescheduled',
  'class.session.canceled',
  'class.sessions.canceled',
  'session.reminder.sent',
  'sessions.reminder.sent',
]);

const DIGEST_PREF_KEYS = new Set<string>([]);

const STANDARD_DELAY_PREF_KEYS = new Set<string>([
  'message.posted',
  'messages.posted',
  'reaction.added',
  'reactions.added',
]);

export function getNotificationPolicyConfig(prefKey: string): NotificationPolicyConfig {
  const critical = CRITICAL_PREF_KEYS.has(prefKey);
  const standardDelay = STANDARD_DELAY_PREF_KEYS.has(prefKey);
  const digestEligible = DIGEST_PREF_KEYS.has(prefKey);
  const defaultDelaySeconds = critical ? 0 : standardDelay ? 60 : 120;

  return {
    prefKey,
    critical,
    presenceAware: true,
    digestEligible: !critical && digestEligible,
    defaultDelaySeconds,
  };
}
