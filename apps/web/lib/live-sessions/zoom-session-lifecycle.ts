import ZoomVideo from '@zoom/videosdk';

export type ZoomClient = ReturnType<typeof ZoomVideo.createClient>;

const disposedClients = new WeakSet<ZoomClient>();
const pendingDisposals = new WeakMap<ZoomClient, ReturnType<typeof setTimeout>>();

export function isZoomExecutedFailure(
  value: unknown,
): value is { type?: unknown; reason: string; errorCode?: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).reason === 'string'
  );
}

export function describeZoomFailure(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const candidate = error as { reason?: unknown; type?: unknown; message?: unknown };
    if (typeof candidate.reason === 'string') return candidate.reason;
    if (typeof candidate.type === 'string') return candidate.type;
    if (typeof candidate.message === 'string') return candidate.message;
  }
  if (typeof error === 'string' && error) return error;
  return 'Failed to join session';
}

export function describeZoomWhiteboardFailure(error: unknown): string {
  const detail = describeZoomFailure(error);
  if (/confId|mmrToken/i.test(detail)) {
    return "Whiteboard isn't available for this session. The Zoom account owner may need to enable Whiteboard for this Video SDK app.";
  }
  return detail === 'Failed to join session'
    ? "Whiteboard couldn't be started. Try again or ask the meeting host to check Whiteboard access."
    : detail;
}

export function dumpZoomFailure(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`;
  }
  try {
    const seen = new WeakSet();
    return JSON.stringify(
      error,
      (_key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[circular]';
          seen.add(value);
        }
        return value;
      },
      2,
    );
  } catch {
    return String(error);
  }
}

export function acquireZoomClient(): ZoomClient {
  const client = ZoomVideo.createClient();
  cancelScheduledZoomClientDisposal(client);
  return client;
}

export async function initializeAndJoinZoomSession(
  client: ZoomClient,
  input: { sessionName: string; token: string; displayName: string },
) {
  const compatibility = ZoomVideo.checkSystemRequirements();
  if (!compatibility.audio || !compatibility.video) {
    throw new Error(
      'This browser does not support the audio and video features required for this class. Update your browser or use a current version of Chrome, Edge, Firefox, or Safari.',
    );
  }

  const initResult = await client.init('en-US', 'Global', {
    patchJsMedia: true,
    stayAwake: true,
    leaveOnPageUnload: true,
  });
  if (isZoomExecutedFailure(initResult)) throw initResult;

  const joinResult = await client.join(input.sessionName, input.token, input.displayName);
  if (isZoomExecutedFailure(joinResult)) throw joinResult;

  return { compatibility, self: client.getCurrentUserInfo() };
}

async function leaveWhiteboardCleanly(client: ZoomClient, selfUserId: number | null) {
  const whiteboardClient = client.getWhiteboardClient();
  const presenter = whiteboardClient.getWhiteboardPresenter();
  if (!presenter) return;
  if (presenter.userId === selfUserId) {
    await whiteboardClient.stopWhiteboardScreen().catch(() => null);
  } else {
    await whiteboardClient.stopWhiteboardView().catch(() => null);
  }
}

export async function disposeZoomClient(
  client: ZoomClient,
  selfUserId: number | null,
  endSession = false,
) {
  if (disposedClients.has(client)) return;
  disposedClients.add(client);
  await leaveWhiteboardCleanly(client, selfUserId);
  await client.leave(endSession).catch(() => null);
  await ZoomVideo.destroyClient().catch(() => null);
}

export function scheduleZoomClientDisposal(
  client: ZoomClient,
  selfUserId: number | null,
) {
  if (disposedClients.has(client) || pendingDisposals.has(client)) return;
  const timeout = setTimeout(() => {
    pendingDisposals.delete(client);
    void disposeZoomClient(client, selfUserId);
  }, 0);
  pendingDisposals.set(client, timeout);
}

export function cancelScheduledZoomClientDisposal(client: ZoomClient) {
  const timeout = pendingDisposals.get(client);
  if (!timeout) return;
  clearTimeout(timeout);
  pendingDisposals.delete(client);
}
