import { AnalyticsEvent } from './analytics';

export type ErrorReporter = (event: string, properties: Record<string, unknown>) => void;

export type ObservedErrorInput = {
  error: unknown;
  source: string;
  message?: string;
  event?: string;
  context?: Record<string, unknown>;
};

let globalErrorReporter: ErrorReporter | null = null;

export function setGlobalErrorReporter(reporter: ErrorReporter | null): void {
  globalErrorReporter = reporter;
}

export function normalizeObservedError(error: unknown): {
  errorName?: string;
  errorMessage: string;
  errorStack?: string;
  code?: string | number;
} {
  if (error instanceof Error) {
    const code = Reflect.get(error, 'code');
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      code: typeof code === 'string' || typeof code === 'number' ? code : undefined,
    };
  }

  if (typeof error === 'string') {
    return { errorMessage: error };
  }

  if (error && typeof error === 'object') {
    const candidate = error as Record<string, unknown>;
    const message = candidate['message'];
    const code = candidate['code'];
    return {
      errorName:
        typeof candidate['name'] === 'string' ? candidate['name'] : 'UnknownError',
      errorMessage:
        typeof message === 'string' ? message : 'Unknown error object was thrown',
      errorStack: typeof candidate['stack'] === 'string' ? candidate['stack'] : undefined,
      code: typeof code === 'string' || typeof code === 'number' ? code : undefined,
    };
  }

  return { errorMessage: 'Unknown non-error value was thrown' };
}

export function buildObservedErrorProperties(
  input: ObservedErrorInput,
): Record<string, unknown> {
  const normalized = normalizeObservedError(input.error);

  return {
    source: input.source,
    message: input.message ?? normalized.errorMessage,
    error_name: normalized.errorName,
    error_message: normalized.errorMessage,
    error_stack: normalized.errorStack,
    code: normalized.code,
    ...input.context,
  };
}

export function reportObservedError(input: ObservedErrorInput): void {
  const properties = buildObservedErrorProperties(input);
  globalErrorReporter?.(input.event ?? AnalyticsEvent.API_ERROR, properties);
}
