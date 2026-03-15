export const STANDARD_SUBJECT_OPTIONS = [
  'Math',
  'English Language Arts',
  'Science',
  'Social Studies',
  'Computer Science',
  'Test Prep',
  'Study Skills',
  'Languages',
  'Arts',
] as const;

export const OTHER_SUBJECT_OPTION = 'Other';

export type StandardSubjectOption = (typeof STANDARD_SUBJECT_OPTIONS)[number];
