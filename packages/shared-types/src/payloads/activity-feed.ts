import type { UUID } from '@iconicedu/shared-types/shared/shared';

export type UpsertActivityVerbSuppressionRuleInput = {
  orgId: UUID;
  eventType: string;
  actorProfileId?: UUID | null;
  isEnabled: boolean;
};

export type DeleteActivityVerbSuppressionRuleInput = {
  orgId: UUID;
  eventType: string;
  actorProfileId?: UUID | null;
};
