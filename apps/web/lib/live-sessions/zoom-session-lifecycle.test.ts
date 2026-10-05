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
    getCurrentUserInfo: vi.fn().mockReturnValue({ userId: 42, isHost: false }),
  } as unknown as ZoomClient;
}

describe('Zoom session lifecycle', () => {
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
      "Whiteboard isn't available for this session. The Zoom account owner may need to enable Whiteboard for this Video SDK app.",
    );
  });
});
