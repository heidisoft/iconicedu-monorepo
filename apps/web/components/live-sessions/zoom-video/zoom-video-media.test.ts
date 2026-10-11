import { VideoQuality } from '@zoom/videosdk';
import { describe, expect, it, vi } from 'vitest';
import type { ZoomClient } from '@iconicedu/web/lib/live-sessions/zoom-session-lifecycle';
import { attachCameraTile, detachCameraTile } from './zoom-video-media';

function fixture() {
  const attachVideo = vi.fn(
    async (_id: number, _quality: VideoQuality, element?: HTMLElement) =>
      element ?? document.createElement('video-player'),
  );
  const detachVideo = vi.fn(async () => undefined);
  const client = {
    getMediaStream: () => ({ attachVideo, detachVideo }),
  } as unknown as ZoomClient;
  return { client, attachVideo, detachVideo, container: document.createElement('div') };
}

describe('camera surface lifecycle', () => {
  it('keeps the player mounted across concurrent events and microphone-only updates', async () => {
    const { client, attachVideo, container } = fixture();
    await Promise.all([
      attachCameraTile(client, 1, container),
      attachCameraTile(client, 1, container),
    ]);
    const player = container.querySelector('video-player');
    await attachCameraTile(client, 1, container);
    expect(attachVideo).toHaveBeenCalledTimes(1);
    expect(container.querySelector('video-player')).toBe(player);
  });

  it('reuses the player when layout changes require a different quality', async () => {
    const { client, attachVideo, container } = fixture();
    await attachCameraTile(client, 1, container);
    const player = container.querySelector('video-player');
    await attachCameraTile(client, 1, container, VideoQuality.Video_180P);
    expect(attachVideo).toHaveBeenLastCalledWith(1, VideoQuality.Video_180P, player);
    expect(container.querySelector('video-player')).toBe(player);
  });

  it('orders stop/start races and scopes detach to the affected renderer', async () => {
    const { client, attachVideo, detachVideo, container } = fixture();
    const other = document.createElement('div');
    await attachCameraTile(client, 1, other);
    const otherPlayer = other.querySelector('video-player');
    const start = attachCameraTile(client, 1, container);
    const stop = detachCameraTile(client, 1, container);
    const restart = attachCameraTile(client, 1, container);
    await Promise.all([start, stop, restart]);
    expect(detachVideo).toHaveBeenCalledTimes(1);
    expect(detachVideo.mock.calls[0]).toHaveLength(2);
    expect(container.querySelector('video-player')).not.toBeNull();
    expect(other.querySelector('video-player')).toBe(otherPlayer);
    expect(attachVideo).toHaveBeenCalledTimes(3);
    await detachCameraTile(client, 1, container);
    await detachCameraTile(client, 1, container);
    expect(detachVideo).toHaveBeenCalledTimes(2);
  });

  it('retries after an SDK attachment failure', async () => {
    const { client, attachVideo, container } = fixture();
    attachVideo.mockRejectedValueOnce(new Error('Camera stopped'));
    await attachCameraTile(client, 1, container);
    await attachCameraTile(client, 1, container);
    expect(container.querySelector('video-player')).not.toBeNull();
    expect(attachVideo).toHaveBeenCalledTimes(2);
  });
});
