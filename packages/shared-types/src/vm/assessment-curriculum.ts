import type { ISODateTime, UUID } from '@iconicedu/shared-types/shared/shared';

export type AssessmentMasteryLevel =
  | 'not_started'
  | 'emerging'
  | 'developing'
  | 'approaching'
  | 'proficient'
  | 'mastered';

export interface AssessmentSubjectVM {
  id: UUID;
  orgId: UUID;
  name: string;
  icon?: string | null;
  color?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  domainCount?: number;
  skillCount?: number;
  itemCount?: number;
}

export interface AssessmentDomainVM {
  id: UUID;
  orgId: UUID;
  subjectId: UUID;
  subjectName: string;
  name: string;
  grade: number;
  description?: string | null;
  orderPosition: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  skills?: AssessmentSkillVM[];
}

export interface AssessmentSkillVM {
  id: UUID;
  orgId: UUID;
  domainId: UUID;
  domainName: string;
  subjectId: UUID;
  subjectName: string;
  name: string;
  description?: string | null;
  standard?: string | null;
  grade: number;
  difficultyBaseline: number;
  estimatedTimeSeconds: number;
  orderPosition: number;
  prerequisites: AssessmentSkillRefVM[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  itemCount?: number;
  itemCountByDifficulty?: Record<number, number>;
}

export interface AssessmentSkillRefVM {
  id: UUID;
  name: string;
  domainName?: string;
  subjectName?: string;
  grade?: number;
}

export interface AssessmentSkillMasteryVM {
  id: UUID;
  profileId: UUID;
  skillId: UUID;
  skillName: string;
  domainName: string;
  subjectName: string;
  grade: number;
  standard?: string | null;
  orgId: UUID;
  level: AssessmentMasteryLevel;
  bestPercentage: number;
  attempts: number;
  lastAssessedAt?: ISODateTime | null;
  updatedAt: ISODateTime;
}
