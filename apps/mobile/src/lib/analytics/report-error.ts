import { reportObservedError } from '@iconicedu/utils';

export function reportMobileObservedError(input: {
  error: unknown;
  source: string;
  message?: string;
  context?: Record<string, unknown>;
  event?: string;
}): void {
  reportObservedError(input);
}
