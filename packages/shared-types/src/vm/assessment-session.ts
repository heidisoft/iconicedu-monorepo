import type { ISODateTime, UUID } from '@iconicedu/shared-types/shared/shared';
import type { AssessmentItemVM } from '@iconicedu/shared-types/vm/assessment-item';

export type AssessmentSessionStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'abandoned';

// ---------------------------------------------------------------------------
// Adaptive engine state
// ---------------------------------------------------------------------------

export interface SkillAdaptiveState {
  skillId: UUID;
  status: 'pending' | 'active' | 'resolved';
  currentDifficulty: number;
  consecutiveCorrect: number;
  consecutiveWrong: number;
  totalCorrect: number;
  totalAttempted: number;
  itemsServed: UUID[];
  prereqSkillsTriggered: UUID[];
  masteryEstimate: number; // 0–100
}

export interface AdaptivePrereqQueueItem {
  skillId: UUID;
  difficulty: number;
  reason: string;
}

export interface AdaptiveState {
  skills: Record<UUID, SkillAdaptiveState>;
  activeSkillId: UUID | null;
  prerequisiteQueue: AdaptivePrereqQueueItem[];
  completedSkillIds: UUID[];
}

// ---------------------------------------------------------------------------
// Session VM
// ---------------------------------------------------------------------------

export interface AssessmentResponseVM {
  id: UUID;
  sessionId: UUID;
  itemId: UUID;
  skillId: UUID;
  difficulty: number;
  responseData: unknown;
  isCorrect?: boolean | null;
  isFlagged: boolean;
  autoScore?: number | null;
  manualScore?: number | null;
  maxScore: number;
  timeSpentSeconds?: number | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface AssessmentSessionVM {
  id: UUID;
  deliveryId: UUID;
  profileId?: UUID | null;
  anonName?: string | null;
  anonEmail?: string | null;
  status: AssessmentSessionStatus;
  attemptNumber: number;
  currentItemId?: UUID | null;
  currentItem?: AssessmentItemVM | null;
  itemOrder: UUID[];
  adaptiveState?: AdaptiveState | null;
  startedAt?: ISODateTime | null;
  submittedAt?: ISODateTime | null;
  timeSpentSeconds?: number | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  responses?: AssessmentResponseVM[];
  totalItems?: number;
  answeredItems?: number;
  flaggedItems?: number;
}

export interface AssessmentSessionListVM {
  id: UUID;
  deliveryId: UUID;
  profileId?: UUID | null;
  profileName?: string | null;
  anonName?: string | null;
  status: AssessmentSessionStatus;
  attemptNumber: number;
  submittedAt?: ISODateTime | null;
  timeSpentSeconds?: number | null;
  createdAt: ISODateTime;
  percentage?: number | null;
  passed?: boolean | null;
}

// Returned from PUT /assessment-sessions/:id/response (next item or null = done)
export interface AssessmentNextItemVM {
  nextItem: AssessmentItemVM | null;
  isComplete: boolean;
  sessionStatus: AssessmentSessionStatus;
  adaptiveNote?: string | null; // e.g. "Detected a gap — giving prerequisite questions"
  itemsAnswered: number;
  itemsTotal: number | null; // null for adaptive (unknown until resolved)
}
