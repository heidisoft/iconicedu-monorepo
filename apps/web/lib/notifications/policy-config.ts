import type { NotificationPolicyConfig } from '@iconicedu/shared-types';

const CRITICAL_PREF_KEYS = new Set<string>([
  'class.session.scheduled',
  'class.sessions.scheduled',
  'class.session.rescheduled',
  'class.sessions.rescheduled',
  'class.session.canceled',
  'class.sessions.canceled',
  'session.started',
  'sessions.started',
  'session.reminder.sent',
  'sessions.reminder.sent',
  'payment.reminder',
  'payments.reminder',
  'payment.failed',
  'payments.failed',
  'system.notice',
  'systems.notice',
]);

const DIGEST_PREF_KEYS = new Set<string>([
  'message.posted',
  'messages.posted',
  'dm.posted',
  'dms.posted',
  'reaction.added',
  'reactions.added',
  'file.uploaded',
  'files.uploaded',
]);

export function getNotificationPolicyConfig(prefKey: string): NotificationPolicyConfig {
  const critical = CRITICAL_PREF_KEYS.has(prefKey);
  const digestEligible = DIGEST_PREF_KEYS.has(prefKey);

  return {
    prefKey,
    critical,
    presenceAware: true,
    digestEligible: !critical && digestEligible,
    defaultDelaySeconds: critical ? 0 : 120,
  };
}
