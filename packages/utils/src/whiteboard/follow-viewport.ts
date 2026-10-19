import type { WhiteboardViewportVM } from '@iconicedu/shared-types';

/** Keep handwriting in a comfortable central region without chasing every small stroke. */
export function resolveWhiteboardFollow(
  current: WhiteboardViewportVM,
  incoming: WhiteboardViewportVM,
  previous: WhiteboardViewportVM | undefined,
  size: { width: number; height: number },
): WhiteboardViewportVM {
  const moved =
    !previous ||
    previous.centerX !== incoming.centerX ||
    previous.centerY !== incoming.centerY ||
    previous.zoom !== incoming.zoom;
  if (!incoming.writing) return moved ? incoming : { ...current, zoom: incoming.zoom };
  const base = moved ? incoming : current;
  const x = incoming.writing.x,
    y = incoming.writing.y;
  const outside =
    Math.abs(x - base.centerX) > (size.width / incoming.zoom) * 0.2 ||
    Math.abs(y - base.centerY) > (size.height / incoming.zoom) * 0.2;
  return {
    centerX: outside ? x : base.centerX,
    centerY: outside ? y : base.centerY,
    zoom: incoming.zoom,
  };
}

/** Platform adapters supply animation scheduling; no browser/native dependency lives here. */
export function animateWhiteboardFollow(
  from: WhiteboardViewportVM,
  to: WhiteboardViewportVM,
  apply: (viewport: WhiteboardViewportVM) => void,
  runtime: {
    request: (callback: (time: number) => void) => number;
    cancel: (id: number) => void;
    blocked: () => boolean;
    reducedMotion: boolean;
  },
) {
  if (runtime.blocked()) return () => {};
  if (runtime.reducedMotion) {
    apply(to);
    return () => {};
  }
  let frame = 0,
    start: number | undefined,
    stopped = false;
  const tick = (time: number) => {
    if (stopped || runtime.blocked()) return;
    start ??= time;
    const progress = Math.min(1, (time - start) / 220);
    const eased = 1 - (1 - progress) ** 3;
    apply({
      centerX: from.centerX + (to.centerX - from.centerX) * eased,
      centerY: from.centerY + (to.centerY - from.centerY) * eased,
      zoom: from.zoom + (to.zoom - from.zoom) * eased,
    });
    if (progress < 1) frame = runtime.request(tick);
  };
  frame = runtime.request(tick);
  return () => {
    stopped = true;
    runtime.cancel(frame);
  };
}
