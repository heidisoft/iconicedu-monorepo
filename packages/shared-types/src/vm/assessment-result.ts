import type { ISODateTime, UUID } from '@iconicedu/shared-types/shared/shared';
import type { AssessmentMasteryLevel } from '@iconicedu/shared-types/vm/assessment-curriculum';

// ---------------------------------------------------------------------------
// Skill scores
// ---------------------------------------------------------------------------

export interface AssessmentSkillScoreVM {
  id: UUID;
  sessionId: UUID;
  deliveryId: UUID;
  profileId?: UUID | null;
  skillId: UUID;
  subject: string;
  domain: string;
  skillName: string;
  standard?: string | null;
  grade: number;
  difficultyAvg: number;
  score: number;
  maxScore: number;
  percentage: number;
  itemsTotal: number;
  itemsCorrect: number;
  masteryLevel: AssessmentMasteryLevel;
}

// Aggregate skill score across all sessions for a delivery (class view)
export interface AssessmentAggregateSkillScoreVM {
  skillId: UUID;
  skillName: string;
  domain: string;
  subject: string;
  grade: number;
  standard?: string | null;
  avgPercentage: number;
  sessionCount: number;
  masteryDistribution: Record<AssessmentMasteryLevel, number>;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export interface ParentReportHighlight {
  type: 'strength' | 'growth_area';
  subject: string;
  skill: string;
  message: string;
}

export interface ParentReport {
  studentName: string;
  testTitle: string;
  completedAt: ISODateTime;
  overallPercentage: number;
  passed: boolean | null;
  overallMessage: string;
  highlights: ParentReportHighlight[];
  encouragement: string;
  suggestedHomeActivities: string[];
}

export interface TutorReportSkillEntry {
  skillId: UUID;
  skillName: string;
  domain: string;
  standard?: string | null;
  grade: number;
  difficultyAvg: number;
  score: number;
  maxScore: number;
  percentage: number;
  masteryLevel: AssessmentMasteryLevel;
  itemsCorrect: number;
  itemsTotal: number;
  prerequisiteGapsDetected: string[];
  recommendedAction: string;
}

export interface TutorReportAdaptivePath {
  itemsServed: number;
  skillsResolved: string[];
  difficultyProgression: { skillId: UUID; skillName: string; difficulties: number[] }[];
}

export interface TutorReport {
  sessionId: UUID;
  testMode: 'standard' | 'adaptive';
  totalScore: number;
  maxScore: number;
  percentage: number;
  timeSpentMinutes: number;
  estimatedTimeMinutes: number;
  skillBreakdown: TutorReportSkillEntry[];
  prerequisiteGapSummary: {
    skill: string;
    triggeredBySkill: string;
    itemsAttempted: number;
    itemsCorrect: number;
  }[];
  adaptivePath?: TutorReportAdaptivePath | null;
  nextLessonSuggestions: string[];
}

export interface LearningGoal {
  skill: string;
  domain: string;
  grade: number;
  standard?: string | null;
  whyItMatters: string;
  currentLevel: string;
  steps: string[];
  prerequisiteSkills: string[];
  estimatedWeeksToMastery: number;
}

export interface WeeklyPracticePlan {
  week: number;
  focus: string;
  activities: string[];
}

export interface StudentLearningPlan {
  studentName: string;
  generatedAt: ISODateTime;
  masteredSkills: { skill: string; badge: string }[];
  learningGoals: LearningGoal[];
  weeklyPracticePlan: WeeklyPracticePlan[];
}

// ---------------------------------------------------------------------------
// Result VM
// ---------------------------------------------------------------------------

export interface MissedItemExplanation {
  itemId: UUID;
  stem: string;
  explanation?: string | null;
  standard?: string | null;
}

export interface FeedbackSkillEntry {
  skillId: UUID;
  skillName: string;
  domain: string;
  subject: string;
  grade: number;
  standard?: string | null;
  difficultyAvg: number;
  score: number;
  maxScore: number;
  percentage: number;
  masteryLevel: AssessmentMasteryLevel;
  explanations: string[];
  prerequisiteSkills: string[];
}

export interface FeedbackReport {
  overallPercent: number;
  passed: boolean | null;
  estimatedTimeSpent: number;
  estimatedTimeExpected: number;
  strengthAreas: FeedbackSkillEntry[];
  improvementAreas: FeedbackSkillEntry[];
  missedExplanations: MissedItemExplanation[];
}

export interface AssessmentResultVM {
  id: UUID;
  sessionId: UUID;
  deliveryId: UUID;
  profileId?: UUID | null;
  totalScore: number;
  maxScore: number;
  percentage: number;
  passed: boolean | null;
  needsManualGrading: boolean;
  completedAt?: ISODateTime | null;
  createdAt: ISODateTime;
  skillScores: AssessmentSkillScoreVM[];
  feedbackReport?: FeedbackReport | null;
  parentReport?: ParentReport | null;
  tutorReport?: TutorReport | null;
  learningPlan?: StudentLearningPlan | null;
}
