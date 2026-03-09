import type { UUID } from '@iconicedu/shared-types/shared/shared';
import type {
  NotificationChannelVM,
  NotificationScopeKindVM,
} from '@iconicedu/shared-types/vm/profile';

export type UpsertNotificationPreferenceInput = {
  orgId: UUID;
  profileId: UUID;
  prefKey: string;
  channels: NotificationChannelVM[];
  muted?: boolean | null;
  scopeKind?: NotificationScopeKindVM;
  scopeId?: UUID;
};

export type DeleteNotificationPreferenceInput = {
  orgId: UUID;
  profileId: UUID;
  prefKey: string;
  scopeKind?: NotificationScopeKindVM;
  scopeId?: UUID;
};
