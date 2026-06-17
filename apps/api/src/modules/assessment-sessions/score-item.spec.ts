import type { AssessmentItemVM } from '@iconicedu/shared-types';
import { scoreItem } from './score-item';

function makeItem(overrides: Partial<AssessmentItemVM>): AssessmentItemVM {
  return {
    id: 'item-1',
    orgId: 'org-1',
    skillId: 'skill-1',
    title: 'Test item',
    type: 'multiple_choice',
    content: {},
    difficulty: 3,
    estimatedTimeSeconds: 60,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as AssessmentItemVM;
}

// ─── multiple_choice ──────────────────────────────────────────────────────────

describe('scoreItem — multiple_choice', () => {
  const item = makeItem({
    type: 'multiple_choice',
    content: {
      stem: 'Pick the right one',
      options: [
        { id: 'a', text: 'Option A', correct: true },
        { id: 'b', text: 'Option B', correct: false },
        { id: 'c', text: 'Option C', correct: false },
      ],
    },
  });

  it('scores correct when response is the correct option ID', () => {
    expect(scoreItem(item, 'a')).toEqual({ isCorrect: true, autoScore: 1, maxScore: 1 });
  });

  it('scores incorrect when response is a wrong option ID', () => {
    expect(scoreItem(item, 'b')).toEqual({ isCorrect: false, autoScore: 0, maxScore: 1 });
  });

  it('scores incorrect when response is null', () => {
    expect(scoreItem(item, null)).toEqual({
      isCorrect: false,
      autoScore: 0,
      maxScore: 1,
    });
  });

  it('scores incorrect when response is an object (old wrapped format)', () => {
    expect(scoreItem(item, { selectedId: 'a' })).toEqual({
      isCorrect: false,
      autoScore: 0,
      maxScore: 1,
    });
  });
});

// ─── true_false ───────────────────────────────────────────────────────────────

describe('scoreItem — true_false', () => {
  const itemTrue = makeItem({
    type: 'true_false',
    content: { stem: '3/6 equals 1/2', correct: true },
  });
  const itemFalse = makeItem({
    type: 'true_false',
    content: { stem: '1/2 equals 2/3', correct: false },
  });

  it('scores correct when student picks true and answer is true', () => {
    expect(scoreItem(itemTrue, true)).toEqual({
      isCorrect: true,
      autoScore: 1,
      maxScore: 1,
    });
  });

  it('scores incorrect when student picks false and answer is true', () => {
    expect(scoreItem(itemTrue, false)).toEqual({
      isCorrect: false,
      autoScore: 0,
      maxScore: 1,
    });
  });

  it('scores correct when student picks false and answer is false', () => {
    expect(scoreItem(itemFalse, false)).toEqual({
      isCorrect: true,
      autoScore: 1,
      maxScore: 1,
    });
  });

  it('scores incorrect when response is null', () => {
    expect(scoreItem(itemTrue, null)).toEqual({
      isCorrect: false,
      autoScore: 0,
      maxScore: 1,
    });
  });

  it('scores incorrect when response is a string (old wrapped format)', () => {
    expect(scoreItem(itemTrue, 'true')).toEqual({
      isCorrect: false,
      autoScore: 0,
      maxScore: 1,
    });
  });
});

// ─── multiple_response ────────────────────────────────────────────────────────

describe('scoreItem — multiple_response', () => {
  const item = makeItem({
    type: 'multiple_response',
    content: {
      stem: 'Select all correct',
      options: [
        { id: 'a', text: 'A', correct: true },
        { id: 'b', text: 'B', correct: true },
        { id: 'c', text: 'C', correct: false },
      ],
    },
  });

  it('scores 1 when all correct options selected and no incorrect ones', () => {
    expect(scoreItem(item, ['a', 'b'])).toEqual({
      isCorrect: true,
      autoScore: 1,
      maxScore: 1,
    });
  });

  it('gives partial credit: 1 of 2 correct with no incorrect', () => {
    const result = scoreItem(item, ['a']);
    expect(result.isCorrect).toBe(false);
    expect(result.autoScore).toBeCloseTo(0.5);
  });

  it('penalises incorrect selection: 2 correct + 1 incorrect → score clamped to 0.5', () => {
    const result = scoreItem(item, ['a', 'b', 'c']);
    expect(result.isCorrect).toBe(false);
    expect(result.autoScore).toBeCloseTo(0.5);
  });

  it('scores 0 when only incorrect option selected', () => {
    expect(scoreItem(item, ['c'])).toEqual({
      isCorrect: false,
      autoScore: 0,
      maxScore: 1,
    });
  });

  it('scores 0 for empty selection', () => {
    expect(scoreItem(item, [])).toEqual({ isCorrect: false, autoScore: 0, maxScore: 1 });
  });
});

// ─── short_answer ─────────────────────────────────────────────────────────────

describe('scoreItem — short_answer', () => {
  const item = makeItem({
    type: 'short_answer',
    content: {
      stem: 'What is 1+1?',
      correctAnswers: ['2', 'two'],
      caseSensitive: false,
    },
  });

  it('scores correct for an exact match', () => {
    expect(scoreItem(item, '2')).toEqual({ isCorrect: true, autoScore: 1, maxScore: 1 });
  });

  it('scores correct for an alternative answer', () => {
    expect(scoreItem(item, 'two')).toEqual({
      isCorrect: true,
      autoScore: 1,
      maxScore: 1,
    });
  });

  it('is case-insensitive when caseSensitive is false', () => {
    expect(scoreItem(item, 'TWO')).toEqual({
      isCorrect: true,
      autoScore: 1,
      maxScore: 1,
    });
  });

  it('scores incorrect for a wrong answer', () => {
    expect(scoreItem(item, 'three')).toEqual({
      isCorrect: false,
      autoScore: 0,
      maxScore: 1,
    });
  });

  it('scores incorrect when response is null', () => {
    expect(scoreItem(item, null)).toEqual({
      isCorrect: false,
      autoScore: 0,
      maxScore: 1,
    });
  });

  it('respects caseSensitive flag', () => {
    const cs = makeItem({
      type: 'short_answer',
      content: { stem: 'Q', correctAnswers: ['Paris'], caseSensitive: true },
    });
    expect(scoreItem(cs, 'paris')).toEqual({
      isCorrect: false,
      autoScore: 0,
      maxScore: 1,
    });
    expect(scoreItem(cs, 'Paris')).toEqual({
      isCorrect: true,
      autoScore: 1,
      maxScore: 1,
    });
  });
});

// ─── essay ────────────────────────────────────────────────────────────────────

describe('scoreItem — essay', () => {
  const item = makeItem({ type: 'essay', content: { stem: 'Explain...' } });

  it('returns null scores (manual grading required)', () => {
    expect(scoreItem(item, 'any text')).toEqual({
      isCorrect: null,
      autoScore: null,
      maxScore: 1,
    });
  });
});

// ─── ordering ─────────────────────────────────────────────────────────────────

describe('scoreItem — ordering', () => {
  const item = makeItem({
    type: 'ordering',
    content: {
      stem: 'Order these',
      items: [
        { id: 'a', text: 'First', correctPosition: 1 },
        { id: 'b', text: 'Second', correctPosition: 2 },
        { id: 'c', text: 'Third', correctPosition: 3 },
      ],
    },
  });

  it('scores 1 when order is perfectly correct', () => {
    expect(scoreItem(item, ['a', 'b', 'c'])).toEqual({
      isCorrect: true,
      autoScore: 1,
      maxScore: 1,
    });
  });

  it('gives partial credit for partially correct order', () => {
    // ['a', 'c', 'b'] — a is correct (pos 1), c is wrong (pos 2), b is wrong (pos 3) → 1/3
    const result = scoreItem(item, ['a', 'c', 'b']);
    expect(result.isCorrect).toBe(false);
    expect(result.autoScore).toBeCloseTo(1 / 3);
  });

  it('scores 0 when all items in wrong positions', () => {
    // ['b', 'c', 'a']: a→pos3(wrong), b→pos1(wrong), c→pos2(wrong)
    const result = scoreItem(item, ['b', 'c', 'a']);
    expect(result.isCorrect).toBe(false);
    expect(result.autoScore).toBe(0);
  });

  it('scores 0 for empty response', () => {
    expect(scoreItem(item, [])).toEqual({ isCorrect: false, autoScore: 0, maxScore: 1 });
  });
});

// ─── matching ─────────────────────────────────────────────────────────────────

describe('scoreItem — matching', () => {
  const item = makeItem({
    type: 'matching',
    content: {
      stem: 'Match these',
      pairs: [
        { left: { id: 'l1', text: 'Left 1' }, right: { id: 'r1', text: 'Right 1' } },
        { left: { id: 'l2', text: 'Left 2' }, right: { id: 'r2', text: 'Right 2' } },
      ],
    },
  });

  it('scores 1 when all pairs matched correctly', () => {
    expect(scoreItem(item, { l1: 'r1', l2: 'r2' })).toEqual({
      isCorrect: true,
      autoScore: 1,
      maxScore: 1,
    });
  });

  it('gives partial credit for one correct pair', () => {
    const result = scoreItem(item, { l1: 'r1', l2: 'r1' });
    expect(result.isCorrect).toBe(false);
    expect(result.autoScore).toBeCloseTo(0.5);
  });

  it('scores 0 when all pairs wrong', () => {
    expect(scoreItem(item, { l1: 'r2', l2: 'r1' })).toEqual({
      isCorrect: false,
      autoScore: 0,
      maxScore: 1,
    });
  });

  it('scores 0 for empty object', () => {
    expect(scoreItem(item, {})).toEqual({ isCorrect: false, autoScore: 0, maxScore: 1 });
  });

  it('scores 0 when response is an array (old wrapped format)', () => {
    expect(scoreItem(item, [{ leftId: 'l1', rightId: 'r1' }])).toEqual({
      isCorrect: false,
      autoScore: 0,
      maxScore: 1,
    });
  });
});

// ─── gap_match ────────────────────────────────────────────────────────────────

describe('scoreItem — gap_match', () => {
  const item = makeItem({
    type: 'gap_match',
    content: {
      template: 'The [[g1]] sat on the [[g2]].',
      gaps: [
        { id: 'g1', correctAnswers: ['cat', 'kitten'], caseSensitive: false },
        { id: 'g2', correctAnswers: ['mat'], caseSensitive: false },
      ],
      options: ['cat', 'mat', 'bat'],
    },
  });

  it('scores 1 when all gaps filled correctly', () => {
    expect(scoreItem(item, { g1: 'cat', g2: 'mat' })).toEqual({
      isCorrect: true,
      autoScore: 1,
      maxScore: 1,
    });
  });

  it('accepts alternative correct answers', () => {
    expect(scoreItem(item, { g1: 'kitten', g2: 'mat' })).toEqual({
      isCorrect: true,
      autoScore: 1,
      maxScore: 1,
    });
  });

  it('is case-insensitive when caseSensitive is false', () => {
    expect(scoreItem(item, { g1: 'CAT', g2: 'MAT' })).toEqual({
      isCorrect: true,
      autoScore: 1,
      maxScore: 1,
    });
  });

  it('gives partial credit for one correct gap', () => {
    const result = scoreItem(item, { g1: 'cat', g2: 'bat' });
    expect(result.isCorrect).toBe(false);
    expect(result.autoScore).toBeCloseTo(0.5);
  });

  it('scores 0 when all gaps wrong', () => {
    expect(scoreItem(item, { g1: 'bat', g2: 'bat' })).toEqual({
      isCorrect: false,
      autoScore: 0,
      maxScore: 1,
    });
  });

  it('scores 0 when response is missing the gap key', () => {
    expect(scoreItem(item, { g1: 'cat' })).toEqual({
      isCorrect: false,
      autoScore: expect.closeTo(0.5),
      maxScore: 1,
    });
  });
});
