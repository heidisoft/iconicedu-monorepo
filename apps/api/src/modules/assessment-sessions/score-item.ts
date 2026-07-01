import type {
  AssessmentItemVM,
  MultipleChoiceContent,
  TrueFalseContent,
  ShortAnswerContent,
  OrderingContent,
  MatchingContent,
  GapMatchContent,
} from '@iconicedu/shared-types';

export interface ScoreResult {
  isCorrect: boolean | null;
  autoScore: number | null;
  maxScore: number;
}

/**
 * Pure scorer for a single assessment item.
 *
 * Response data formats (matching what each widget sends):
 *   multiple_choice  — raw string (option ID)
 *   true_false       — raw boolean (true | false)
 *   multiple_response — string[] (selected option IDs)
 *   short_answer     — raw string
 *   ordering         — string[] where index i = user's chosen position i+1
 *   matching         — { [leftId]: rightId } plain object
 *   gap_match        — { [gapId]: answer } plain object
 *   essay            — unscored; returns autoScore: null
 */
export function scoreItem(item: AssessmentItemVM, responseData: unknown): ScoreResult {
  switch (item.type) {
    case 'multiple_choice': {
      const c = item.content as MultipleChoiceContent;
      const selectedId = typeof responseData === 'string' ? responseData : undefined;
      const correct = c.options?.find((o) => o.correct);
      const isCorrect = !!correct && correct.id === selectedId;
      return { isCorrect, autoScore: isCorrect ? 1 : 0, maxScore: 1 };
    }
    case 'true_false': {
      // TrueFalseContent is { stem, correct: boolean } — not an options array
      const c = item.content as TrueFalseContent;
      const selected = typeof responseData === 'boolean' ? responseData : null;
      const isCorrect = selected !== null && selected === c.correct;
      return { isCorrect, autoScore: isCorrect ? 1 : 0, maxScore: 1 };
    }
    case 'multiple_response': {
      const c = item.content as MultipleChoiceContent;
      const selected: string[] = Array.isArray(responseData)
        ? (responseData as string[])
        : [];
      const correctIds = c.options?.filter((o) => o.correct).map((o) => o.id) ?? [];
      const incorrectIds = c.options?.filter((o) => !o.correct).map((o) => o.id) ?? [];
      const correctSelected = selected.filter((id) => correctIds.includes(id)).length;
      const incorrectSelected = selected.filter((id) => incorrectIds.includes(id)).length;
      const score = Math.max(
        0,
        (correctSelected - incorrectSelected) / (correctIds.length || 1),
      );
      return { isCorrect: score === 1, autoScore: score, maxScore: 1 };
    }
    case 'short_answer': {
      const c = item.content as ShortAnswerContent;
      const answer = typeof responseData === 'string' ? responseData : '';
      const correct = c.correctAnswers?.some((ca: string) =>
        c.caseSensitive ? ca === answer : ca.toLowerCase() === answer.toLowerCase(),
      );
      return { isCorrect: !!correct, autoScore: correct ? 1 : 0, maxScore: 1 };
    }
    case 'essay':
      return { isCorrect: null, autoScore: null, maxScore: 1 };
    case 'ordering': {
      const c = item.content as OrderingContent;
      const userOrder = Array.isArray(responseData) ? (responseData as string[]) : [];
      const items = c.items ?? [];
      const correct = items.filter((it) => {
        const userPosition = userOrder.indexOf(it.id) + 1;
        return userPosition > 0 && userPosition === it.correctPosition;
      }).length;
      const score = correct / (items.length || 1);
      return { isCorrect: score === 1, autoScore: score, maxScore: 1 };
    }
    case 'matching': {
      const c = item.content as MatchingContent;
      const matchMap =
        responseData !== null &&
        typeof responseData === 'object' &&
        !Array.isArray(responseData)
          ? (responseData as Record<string, string>)
          : {};
      const pairs = c.pairs ?? [];
      const correctPairs = pairs.filter((p) => matchMap[p.left.id] === p.right.id).length;
      const score = correctPairs / (pairs.length || 1);
      return { isCorrect: score === 1, autoScore: score, maxScore: 1 };
    }
    case 'gap_match': {
      const c = item.content as GapMatchContent;
      const answerMap =
        responseData !== null &&
        typeof responseData === 'object' &&
        !Array.isArray(responseData)
          ? (responseData as Record<string, string>)
          : {};
      const gaps = c.gaps ?? [];
      const correctGaps = gaps.filter((g) => {
        const given = answerMap[g.id] ?? '';
        return g.correctAnswers.some((ca) =>
          g.caseSensitive ? ca === given : ca.toLowerCase() === given.toLowerCase(),
        );
      }).length;
      const score = correctGaps / (gaps.length || 1);
      return { isCorrect: score === 1, autoScore: score, maxScore: 1 };
    }
    default:
      return { isCorrect: null, autoScore: null, maxScore: 1 };
  }
}
