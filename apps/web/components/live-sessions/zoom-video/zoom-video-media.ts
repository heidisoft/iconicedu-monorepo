import { VideoQuality } from '@zoom/videosdk';

import type { ZoomClient } from '@iconicedu/web/lib/live-sessions/zoom-session-lifecycle';

type Player = Awaited<
  ReturnType<ReturnType<ZoomClient['getMediaStream']>['attachVideo']>
>;
type Attachment = {
  tail: Promise<void>;
  client?: ZoomClient;
  userId?: number;
  quality?: VideoQuality;
  element?: Extract<Player, HTMLElement>;
};

// SDK events and React effects can request the same tile concurrently. Serialize
// work per surface, retain its player, and detach only that surface's renderer.
const attachments = new WeakMap<HTMLElement, Attachment>();
function attachmentFor(container: HTMLElement) {
  let attachment = attachments.get(container);
  if (!attachment) {
    attachment = { tail: Promise.resolve() };
    attachments.set(container, attachment);
  }
  return attachment;
}

export function attachCameraTile(
  client: ZoomClient,
  userId: number,
  container: HTMLElement,
  quality: VideoQuality = VideoQuality.Video_360P,
) {
  const attachment = attachmentFor(container);
  attachment.tail = attachment.tail.then(async () => {
    try {
      const sameParticipant =
        attachment.client === client && attachment.userId === userId;
      if (
        sameParticipant &&
        attachment.quality === quality &&
        attachment.element &&
        container.contains(attachment.element)
      )
        return;
      if (
        !sameParticipant &&
        attachment.element &&
        attachment.client &&
        attachment.userId !== undefined
      ) {
        await attachment.client
          .getMediaStream()
          .detachVideo(attachment.userId, attachment.element);
        attachment.element.remove();
        attachment.element = undefined;
      }
      const element = await client
        .getMediaStream()
        .attachVideo(userId, quality, attachment.element);
      if (!(element instanceof HTMLElement)) return;
      element.setAttribute('data-zoom-user-id', String(userId));
      element.className = 'h-full w-full object-cover';
      let playerContainer = container.querySelector('video-player-container');
      if (!playerContainer) {
        playerContainer = document.createElement('video-player-container');
        playerContainer.className = 'block h-full w-full';
        container.replaceChildren(playerContainer);
      }
      if (!playerContainer.contains(element)) playerContainer.replaceChildren(element);
      Object.assign(attachment, { client, userId, quality, element });
    } catch {
      // A participant can stop video while an attachment is in flight. A later
      // state update retries failed attachments instead of caching the failure.
    }
  });
  return attachment.tail;
}

export function detachCameraTile(
  client: ZoomClient,
  userId: number,
  container: HTMLElement,
) {
  const attachment = attachmentFor(container);
  attachment.tail = attachment.tail.then(async () => {
    if (
      attachment.client !== client ||
      attachment.userId !== userId ||
      !attachment.element
    )
      return;
    try {
      await client.getMediaStream().detachVideo(userId, attachment.element);
    } catch {
      // The SDK may already have detached a participant that just left.
    } finally {
      attachment.element.remove();
      attachment.element = undefined;
      attachment.quality = undefined;
    }
  });
  return attachment.tail;
}
