import {
  AnalyticsEvent,
  buildObservedErrorProperties,
  reportObservedError,
} from '@iconicedu/utils';

type WebObservedErrorInput = {
  error: unknown;
  source: string;
  message?: string;
  context?: Record<string, unknown>;
  distinctId?: string | null;
  event?: string;
};

function getServerPosthogConfig() {
  const key =
    process.env.POSTHOG_KEY?.trim() ?? process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ?? '';
  const host =
    process.env.POSTHOG_HOST?.trim() ??
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ??
    'https://t.iconicedu.lk';

  return { key, host: host.replace(/\/$/, '') };
}

function isLocalServerRuntime() {
  return process.env.NODE_ENV !== 'production';
}

async function captureServerObservedError(input: WebObservedErrorInput): Promise<void> {
  const { key, host } = getServerPosthogConfig();
  if (!key || !host || isLocalServerRuntime()) return;

  const event = input.event ?? AnalyticsEvent.API_ERROR;
  const properties = buildObservedErrorProperties(input);

  try {
    await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: key,
        event,
        distinct_id: input.distinctId?.trim() || input.source,
        properties,
      }),
      cache: 'no-store',
    });
  } catch {
    // Error reporting must stay best-effort.
  }
}

export function reportWebObservedError(input: WebObservedErrorInput): void {
  if (typeof window !== 'undefined') {
    reportObservedError({
      error: input.error,
      source: input.source,
      message: input.message,
      context: input.context,
      event: input.event,
    });
    return;
  }

  void captureServerObservedError(input);
}
