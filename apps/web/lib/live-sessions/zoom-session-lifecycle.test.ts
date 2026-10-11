import { beforeEach, describe, expect, it, vi } from 'vitest';

const zoomSdk = vi.hoisted(() => ({
  checkSystemRequirements: vi.fn(),
  createClient: vi.fn(),
  destroyClient: vi.fn(),
}));

vi.mock('@zoom/videosdk', () => ({ default: zoomSdk }));

import {
  describeZoomFailure,
  describeZoomWhiteboardFailure,
  dumpZoomFailure,
  initializeAndJoinZoomSession,
  isZoomExecutedFailure,
  type ZoomClient,
} from '@iconicedu/web/lib/live-sessions/zoom-session-lifecycle';

function createClient() {
  return {
    init: vi.fn().mockResolvedValue(''),
    join: vi.fn().mockResolvedValue({ userId: 42 }),
    isOriginalHost: vi.fn().mockReturnValue(false),
    isHost: vi.fn().mockReturnValue(false),
    reclaimHost: vi.fn().mockResolvedValue(''),
    getCurrentUserInfo: vi.fn().mockReturnValue({ userId: 42, isHost: false }),
  } as unknown as ZoomClient;
}

describe('Zoom session lifecycle', () => {
  it('claims host for a verified host token after joining an existing meeting', async () => {
    const client = createClient();
    vi.mocked(client.isOriginalHost).mockReturnValue(true);
    vi.mocked(client.reclaimHost).mockImplementation(async () => {
      vi.mocked(client.getCurrentUserInfo).mockReturnValue({
        userId: 42,
        isHost: true,
      } as never);
      return '';
    });
    const result = await initializeAndJoinZoomSession(client, {
      sessionName: 'class',
      token: 'host-token',
      displayName: 'Teacher',
    });
    expect(client.reclaimHost).toHaveBeenCalledOnce();
    expect(result.self.isHost).toBe(true);
  });
  it('never claims host for participant credentials', async () => {
    const client = createClient();
    await initializeAndJoinZoomSession(client, {
      sessionName: 'class',
      token: 'participant-token',
      displayName: 'Student',
    });
    expect(client.reclaimHost).not.toHaveBeenCalled();
  });
  it('reports a host claim failure instead of presenting a successful host join', async () => {
    const client = createClient();
    vi.mocked(client.isOriginalHost).mockReturnValue(true);
    const error = { reason: 'Unable to claim host', errorCode: 1 };
    vi.mocked(client.reclaimHost).mockResolvedValue(error as never);
    await expect(
      initializeAndJoinZoomSession(client, {
        sessionName: 'class',
        token: 'host-token',
        displayName: 'Teacher',
      }),
    ).rejects.toEqual(error);
  });
  beforeEach(() => {
    vi.clearAllMocks();
    zoomSdk.checkSystemRequirements.mockReturnValue({
      audio: true,
      video: true,
      screen: true,
    });
  });

  it('initializes with the maintained SDK options before joining', async () => {
    const client = createClient();

    const result = await initializeAndJoinZoomSession(client, {
      sessionName: 'math-class',
      token: 'test-token',
      displayName: 'Alex',
    });

    expect(client.init).toHaveBeenCalledWith('en-US', 'Global', {
      patchJsMedia: true,
      stayAwake: true,
      leaveOnPageUnload: true,
    });
    expect(client.join).toHaveBeenCalledWith('math-class', 'test-token', 'Alex');
    expect(result.self).toMatchObject({ userId: 42 });
  });

  it('rejects unsupported browsers before initializing the SDK', async () => {
    zoomSdk.checkSystemRequirements.mockReturnValue({
      audio: false,
      video: true,
      screen: false,
    });
    const client = createClient();

    await expect(
      initializeAndJoinZoomSession(client, {
        sessionName: 'math-class',
        token: 'test-token',
        displayName: 'Alex',
      }),
    ).rejects.toThrow('does not support the audio and video features');
    expect(client.init).not.toHaveBeenCalled();
  });

  it('shares an in-flight join when Strict Mode replays setup', async () => {
    const client = createClient();
    let finishInit!: (value: string) => void;
    vi.mocked(client.init).mockReturnValue(
      new Promise((resolve) => {
        finishInit = resolve;
      }),
    );
    const input = { sessionName: 'math-class', token: 'test-token', displayName: 'Alex' };
    const first = initializeAndJoinZoomSession(client, input);
    const replay = initializeAndJoinZoomSession(client, { ...input });

    expect(replay).toBe(first);
    expect(client.init).toHaveBeenCalledOnce();
    expect(client.join).not.toHaveBeenCalled();
    finishInit('');
    await Promise.all([first, replay]);
    expect(client.join).toHaveBeenCalledOnce();
  });

  it('allows retry after a failed initialization without retaining a rejected join', async () => {
    const client = createClient();
    const failure = { type: 'INVALID_OPERATION', reason: 'Initialization failed' };
    vi.mocked(client.init).mockResolvedValueOnce(failure as never);
    const input = { sessionName: 'math-class', token: 'test-token', displayName: 'Alex' };
    await expect(initializeAndJoinZoomSession(client, input)).rejects.toEqual(failure);
    await initializeAndJoinZoomSession(client, input);
    expect(client.init).toHaveBeenCalledTimes(2);
    expect(client.join).toHaveBeenCalledOnce();
  });

  it('does not reuse an in-flight join for different credentials', async () => {
    const client = createClient();
    const input = { sessionName: 'math-class', token: 'test-token', displayName: 'Alex' };
    const first = initializeAndJoinZoomSession(client, input);
    await expect(
      initializeAndJoinZoomSession(client, { ...input, token: 'other-token' }),
    ).rejects.toThrow('already in progress');
    await first;
    expect(client.join).toHaveBeenCalledOnce();
  });

  it('recognizes resolved Zoom failures without rejecting successful join objects', () => {
    expect(
      isZoomExecutedFailure({ type: 'OPERATION_CANCELLED', reason: 'LEAVING' }),
    ).toBe(true);
    expect(isZoomExecutedFailure({ userId: 42, displayName: 'Alex' })).toBe(false);
  });

  it('creates safe user-facing and diagnostic error text', () => {
    const circular: Record<string, unknown> = { reason: 'Join failed' };
    circular.self = circular;

    expect(describeZoomFailure(circular)).toBe('Join failed');
    expect(dumpZoomFailure(circular)).toContain('[circular]');
  });

  it('translates missing Zoom whiteboard credentials into actionable UI text', () => {
    expect(
      describeZoomWhiteboardFailure(new Error('get confId or mmrToken failed')),
    ).toBe(
      'Zoom could not authenticate the whiteboard for this session. Try rejoining. If it still fails, ask the host to check Zoom Whiteboard access and network connectivity.',
    );
  });
});
