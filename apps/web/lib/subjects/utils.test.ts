import { describe, expect, it } from 'vitest';

import {
  mergeSubjectOptions,
  normalizeSubjectKey,
  normalizeSubjectLabel,
  SUBJECT_KEY_REGEX,
} from './utils';

describe('subject utils', () => {
  it('normalizes subject labels and keys', () => {
    expect(normalizeSubjectLabel('  English   Language Arts  ')).toBe(
      'English Language Arts',
    );
    expect(normalizeSubjectKey('  English   Language Arts  ')).toBe(
      'english-language-arts',
    );
  });

  it('normalizes machine-name subject keys', () => {
    expect(normalizeSubjectKey('STEM & Robotics')).toBe('stem-robotics');
    expect(SUBJECT_KEY_REGEX.test(normalizeSubjectKey('STEM & Robotics'))).toBe(true);
  });

  it('merges active options with legacy values without duplicates', () => {
    expect(
      mergeSubjectOptions(['Math', 'Science'], [' math ', 'Robotics', null, '']),
    ).toEqual(['Math', 'Science', 'Robotics']);
  });
});
