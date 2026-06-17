import type { ISODateTime, UUID } from '@iconicedu/shared-types/shared/shared';

export type AssessmentAccessType =
  | 'public'
  | 'authenticated'
  | 'class'
  | 'specific_users';

export interface AssessmentDeliveryVM {
  id: UUID;
  orgId: UUID;
  testId: UUID;
  testTitle: string;
  testMode: 'standard' | 'adaptive';
  title: string;
  accessType: AssessmentAccessType;
  accessToken?: string | null;
  publicUrl?: string | null;
  channelId?: UUID | null;
  channelName?: string | null;
  startsAt?: ISODateTime | null;
  endsAt?: ISODateTime | null;
  maxAttempts: number;
  collectNameEmail: boolean;
  allowResume: boolean;
  createdBy?: UUID | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  sessionCount?: number;
  completedCount?: number;
  estimatedMinutes?: number;
  skillCount?: number;
}

export interface AssessmentDeliveryListVM {
  id: UUID;
  orgId: UUID;
  testId: UUID;
  testTitle: string;
  title: string;
  accessType: AssessmentAccessType;
  accessToken?: string | null;
  startsAt?: ISODateTime | null;
  endsAt?: ISODateTime | null;
  sessionCount: number;
  completedCount: number;
  createdAt: ISODateTime;
}
