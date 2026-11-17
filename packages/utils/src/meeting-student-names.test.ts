import { describe, expect, it } from 'vitest';
import { formatMeetingStudentNames } from './meeting-student-names';
describe('shared meeting student labels', () => {
  it.each([
    [[], ''],
    [['Student One'], 'Student One'],
    [['Student One', 'Student Two'], 'Student One & Student Two'],
    [
      ['Student One', 'Student Two', 'Student Three'],
      'Student One, Student Two & Student Three',
    ],
  ])('formats %j', (names, expected) => {
    expect(formatMeetingStudentNames(names as string[])).toBe(expected);
  });
  it('keeps each selected student represented when the SDK name limit is exceeded', () => {
    const label = formatMeetingStudentNames([
      'StudentOne'.repeat(20),
      'StudentTwo'.repeat(20),
    ]);
    expect(label.length).toBeLessThanOrEqual(80);
    expect(label).toContain('StudentOne');
    expect(label).toContain(' & StudentTwo');
  });
});
