import { VideoQuality } from '@zoom/videosdk';

import type { ZoomClient } from '@iconicedu/web/lib/live-sessions/zoom-session-lifecycle';

export async function attachCameraTile(
  client: ZoomClient,
  userId: number,
  container: HTMLElement,
  quality: VideoQuality = VideoQuality.Video_360P,
) {
  try {
    const element = await client.getMediaStream().attachVideo(userId, quality);
    if (!(element instanceof HTMLElement)) return;
    element.setAttribute('data-zoom-user-id', String(userId));
    element.className = 'h-full w-full object-cover';
    let playerContainer = container.querySelector('video-player-container');
    if (!playerContainer) {
      playerContainer = document.createElement('video-player-container');
      playerContainer.className = 'block h-full w-full';
      container.replaceChildren(playerContainer);
    }
    playerContainer.replaceChildren(element);
  } catch {
    // A participant can stop video while an attachment is in flight.
  }
}

export async function detachCameraTile(
  client: ZoomClient,
  userId: number,
  container: HTMLElement,
) {
  try {
    await client.getMediaStream().detachVideo(userId);
  } catch {
    // The SDK may already have detached a participant that just left.
  } finally {
    container.replaceChildren();
  }
}
