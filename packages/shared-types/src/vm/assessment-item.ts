import type { ISODateTime, UUID } from '@iconicedu/shared-types/shared/shared';

export type AssessmentItemType =
  | 'multiple_choice'
  | 'multiple_response'
  | 'true_false'
  | 'short_answer'
  | 'essay'
  | 'ordering'
  | 'matching'
  | 'gap_match';

// ---------------------------------------------------------------------------
// Item content payloads (discriminated by type)
// ---------------------------------------------------------------------------

export interface ItemOption {
  id: string;
  text: string;
  correct: boolean;
}

export interface ItemMediaRef {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface MultipleChoiceContent {
  stem: string;
  media?: ItemMediaRef | null;
  options: ItemOption[];
  shuffle: boolean;
  feedback?: { correct?: string; incorrect?: string } | null;
}

export type MultipleResponseContent = MultipleChoiceContent;

export interface TrueFalseContent {
  stem: string;
  correct: boolean; // true = "True" is correct
  feedback?: { correct?: string; incorrect?: string } | null;
}

export interface ShortAnswerContent {
  stem: string;
  correctAnswers: string[];
  caseSensitive: boolean;
  partialCredit: boolean;
}

export interface EssayContent {
  stem: string;
  rubric?: string | null;
  wordLimit?: number | null;
}

export interface OrderingItem {
  id: string;
  text: string;
  correctPosition: number;
}

export interface OrderingContent {
  stem: string;
  items: OrderingItem[];
  shuffle: boolean;
}

export interface MatchingPair {
  left: { id: string; text: string };
  right: { id: string; text: string };
}

export interface MatchingContent {
  stem: string;
  pairs: MatchingPair[];
  shuffleRight: boolean;
}

export interface GapMatchGap {
  id: string;
  correctAnswers: string[];
  caseSensitive: boolean;
}

export interface GapMatchContent {
  template: string; // "The capital of [[gap1]] is [[gap2]]."
  gaps: GapMatchGap[];
}

export type AssessmentItemContent =
  | MultipleChoiceContent
  | MultipleResponseContent
  | TrueFalseContent
  | ShortAnswerContent
  | EssayContent
  | OrderingContent
  | MatchingContent
  | GapMatchContent;

// ---------------------------------------------------------------------------
// Item VM
// ---------------------------------------------------------------------------

export interface AssessmentItemVM {
  id: UUID;
  orgId: UUID;
  skillId: UUID;
  skillName: string;
  domainName: string;
  subjectName: string;
  grade: number;
  standard?: string | null;
  title: string;
  type: AssessmentItemType;
  content: AssessmentItemContent;
  explanation?: string | null;
  difficulty: number;
  estimatedTimeSeconds?: number | null;
  createdBy?: UUID | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface AssessmentItemListVM {
  id: UUID;
  orgId: UUID;
  skillId: UUID;
  skillName: string;
  domainName: string;
  subjectName: string;
  grade: number;
  standard?: string | null;
  title: string;
  type: AssessmentItemType;
  difficulty: number;
  estimatedTimeSeconds?: number | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
