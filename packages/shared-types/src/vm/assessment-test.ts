import type { ISODateTime, UUID } from '@iconicedu/shared-types/shared/shared';
import type { AssessmentItemVM } from '@iconicedu/shared-types/vm/assessment-item';

export type AssessmentTestMode = 'standard' | 'adaptive';

export interface AdaptiveConfig {
  prereqTriggerMissCount: number;
  prereqItemsToInject: number;
  advanceTriggerCorrectCount: number;
  advanceDifficultyStep: number;
  stopOnConsecutiveCorrect: number;
  stopOnConsecutiveWrong: number;
  maxItemsPerSkill: number;
  minItemsPerSkill: number;
}

export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveConfig = {
  prereqTriggerMissCount: 2,
  prereqItemsToInject: 2,
  advanceTriggerCorrectCount: 3,
  advanceDifficultyStep: 1,
  stopOnConsecutiveCorrect: 3,
  stopOnConsecutiveWrong: 2,
  maxItemsPerSkill: 8,
  minItemsPerSkill: 3,
};

export interface AssessmentTestSectionItemVM {
  id: UUID;
  sectionId: UUID;
  itemId: UUID;
  orderPosition: number;
  points: number;
  item?: AssessmentItemVM;
}

export interface AssessmentTestSectionVM {
  id: UUID;
  testId: UUID;
  title?: string | null;
  orderPosition: number;
  shuffleItems: boolean;
  itemsToShow?: number | null;
  items: AssessmentTestSectionItemVM[];
}

export interface AssessmentSkillPoolVM {
  id: UUID;
  testId: UUID;
  skillId: UUID;
  skillName: string;
  domainName: string;
  subjectName: string;
  grade: number;
  standard?: string | null;
  targetItems: number;
  minItems: number;
  maxItems: number;
  startDifficulty: number;
  orderPosition: number;
  itemCount?: number;
  itemCountByDifficulty?: Record<number, number>;
}

export interface AssessmentTestVM {
  id: UUID;
  orgId: UUID;
  title: string;
  description?: string | null;
  instructions?: string | null;
  mode: AssessmentTestMode;
  timeLimitMinutes?: number | null;
  passingScorePercent?: number | null;
  shuffleSections: boolean;
  showResultsImmediately: boolean;
  showCorrectAnswers: boolean;
  adaptiveConfig?: AdaptiveConfig | null;
  createdBy?: UUID | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  sections?: AssessmentTestSectionVM[];
  skillPools?: AssessmentSkillPoolVM[];
  totalItems?: number;
  estimatedMinutes?: number;
}

export interface AssessmentTestListVM {
  id: UUID;
  orgId: UUID;
  title: string;
  mode: AssessmentTestMode;
  totalItems: number;
  estimatedMinutes: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
