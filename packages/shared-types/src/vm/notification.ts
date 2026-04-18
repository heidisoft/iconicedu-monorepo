import type { ISODateTime, UUID } from '@iconicedu/shared-types/shared/shared';

export type NotificationDeliveryChannel = 'push' | 'email' | 'sms';

export type NotificationDeliveryTiming = 'immediate' | 'delayed' | 'digest';

export type NotificationDecisionReason =
  | 'no_channels_enabled'
  | 'scoped_preference'
  | 'global_preference'
  | 'system_default'
  | 'mention_priority_override'
  | 'presence_active'
  | 'channel_recently_read'
  | 'critical_override';

export interface NotificationPolicyConfig {
  prefKey: string;
  critical: boolean;
  presenceAware: boolean;
  digestEligible: boolean;
  defaultDelaySeconds: number;
}

export interface NotificationDecisionVM {
  eventId: UUID;
  recipientProfileId: UUID;
  prefKey: string;
  shouldWriteInbox: boolean;
  deliveryChannels: NotificationDeliveryChannel[];
  deliveryTiming: NotificationDeliveryTiming;
  runAt: ISODateTime;
  reasonCodes: NotificationDecisionReason[];
  policy: NotificationPolicyConfig;
}
