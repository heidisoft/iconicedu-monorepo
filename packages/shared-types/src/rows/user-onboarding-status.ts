import type {
  ISODateTime,
  OnboardingStep,
  UUID,
} from '@iconicedu/shared-types/shared/shared';

export interface UserOnboardingStatusRow {
  id: UUID;
  org_id: UUID;
  profile_id: UUID;
  current_step?: OnboardingStep | null;
  last_completed_step?: OnboardingStep | null;
  progress?: Record<string, unknown> | null;
  completed: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  deleted_at?: ISODateTime | null;
}
