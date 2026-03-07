import { describe, expect, it } from 'vitest';

import { getAssignmentTypeLabel } from './lesson-assignment-message';

describe('lesson-assignment-message helpers', () => {
  it('returns a homework label by default', () => {
    expect(getAssignmentTypeLabel()).toBe('Homework');
    expect(getAssignmentTypeLabel('homework')).toBe('Homework');
  });

  it('returns a lesson label when assignment kind is lesson', () => {
    expect(getAssignmentTypeLabel('lesson')).toBe('Lesson');
  });
});
