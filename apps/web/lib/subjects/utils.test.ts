import { describe, expect, it } from 'vitest';

import { mergeSubjectOptions, normalizeSubjectKey, normalizeSubjectLabel } from './utils';

describe('subject utils', () => {
  it('normalizes subject labels and keys', () => {
    expect(normalizeSubjectLabel('  English   Language Arts  ')).toBe(
      'English Language Arts',
    );
    expect(normalizeSubjectKey('  English   Language Arts  ')).toBe(
      'english language arts',
    );
  });

  it('merges active options with legacy values without duplicates', () => {
    expect(
      mergeSubjectOptions(['Math', 'Science'], [' math ', 'Robotics', null, '']),
    ).toEqual(['Math', 'Science', 'Robotics']);
  });
});
