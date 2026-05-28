export const CLASS_REQUEST_INTENT_OPTIONS = [
  {
    value: 'trial-class',
    label: 'Trial class',
    description: 'Check tutor fit, teaching style, and schedule before regular classes.',
  },
  {
    value: 'learning-match-call',
    label: 'Free consultation / learning match call',
    description: 'Talk through curriculum, schedule, goals, and learner needs first.',
  },
  {
    value: 'urgent-homework-help',
    label: 'Urgent homework help',
    description: 'Share the assignment topic, deadline, and preferred availability.',
  },
  {
    value: 'same-week-support',
    label: 'Same-week tutoring support',
    description: 'Ask for near-term support where tutor availability allows.',
  },
  {
    value: 'ongoing-tutoring',
    label: 'Ongoing tutoring',
    description:
      'Set up regular support for schoolwork, confidence, and long-term goals.',
  },
] as const;

export type ClassRequestIntent = (typeof CLASS_REQUEST_INTENT_OPTIONS)[number]['value'];

export const CLASS_REQUEST_INTENT_LABELS: Record<ClassRequestIntent, string> =
  CLASS_REQUEST_INTENT_OPTIONS.reduce(
    (labels, option) => ({
      ...labels,
      [option.value]: option.label,
    }),
    {} as Record<ClassRequestIntent, string>,
  );

export function isClassRequestIntent(value: unknown): value is ClassRequestIntent {
  return (
    typeof value === 'string' &&
    CLASS_REQUEST_INTENT_OPTIONS.some((option) => option.value === value)
  );
}
