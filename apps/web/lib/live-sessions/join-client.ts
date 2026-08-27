export type ClassSessionOccurrenceRef = {
  scheduleId: string;
  occurrenceKey: string;
};

type JoinResponsePayload = {
  success?: boolean;
  joinPath?: string;
  error?: string;
  reason?: string;
};

export class LiveSessionJoinError extends Error {
  constructor(
    message: string,
    readonly reason: string | null,
  ) {
    super(message);
    this.name = 'LiveSessionJoinError';
  }
}

async function postJoin(path: string, body: unknown): Promise<string> {
  const response = await window.fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as JoinResponsePayload | null;

  if (!response.ok || !payload?.success || !payload.joinPath) {
    // Surfacing the failure rather than falling through to some other target is
    // deliberate: a failed join must never silently navigate the user into an
    // unrelated classroom or huddle (issue #195).
    throw new LiveSessionJoinError(
      payload?.error ?? 'Failed to join live session',
      payload?.reason ?? null,
    );
  }

  return payload.joinPath;
}

/**
 * Browser-side entry point for joining a class session.
 *
 * When the caller knows which occurrence was clicked, the request targets that
 * exact occurrence. Only the classroom header — which means "the class on right
 * now" — falls back to the channel-scoped endpoint.
 */
export async function requestLiveSessionJoin(input: {
  orgSlug: string;
  channelId?: string | null;
  occurrence?: ClassSessionOccurrenceRef | null;
}): Promise<string> {
  if (input.occurrence) {
    return postJoin('/api/live-sessions/class-sessions/join', {
      orgSlug: input.orgSlug,
      scheduleId: input.occurrence.scheduleId,
      occurrenceKey: input.occurrence.occurrenceKey,
    });
  }

  if (!input.channelId) {
    throw new LiveSessionJoinError('Failed to join live session', null);
  }

  return postJoin(`/api/channels/${input.channelId}/live-sessions/join`, {
    orgSlug: input.orgSlug,
  });
}
