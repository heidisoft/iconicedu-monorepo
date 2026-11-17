import { expect, it, vi } from 'vitest';
import { resolveWhiteboardFollow, animateWhiteboardFollow } from './follow-viewport';
const original = { centerX: 0, centerY: 0, zoom: 1 };
it('centers offscreen handwriting for a portrait participant without requiring presenter scroll', () => {
  expect(
    resolveWhiteboardFollow(
      original,
      { ...original, writing: { x: 700, y: -500 } },
      original,
      { width: 390, height: 600 },
    ),
  ).toEqual({ centerX: 700, centerY: -500, zoom: 1 });
});
it('does not chase small handwriting movements inside the comfortable central region', () => {
  expect(
    resolveWhiteboardFollow(
      original,
      { ...original, writing: { x: 20, y: 30 } },
      original,
      { width: 390, height: 600 },
    ),
  ).toEqual(original);
});
it('holds the writing position after pen-up instead of snapping back to the tutor viewport', () => {
  const source = { ...original, writing: { x: 700, y: 500 } };
  expect(
    resolveWhiteboardFollow({ centerX: 700, centerY: 500, zoom: 1 }, original, source, {
      width: 390,
      height: 600,
    }),
  ).toEqual({ centerX: 700, centerY: 500, zoom: 1 });
});
it('honors explicit tutor scroll and zoom after writing ends', () => {
  const next = { centerX: -200, centerY: 300, zoom: 2 };
  expect(
    resolveWhiteboardFollow(original, next, original, { width: 800, height: 600 }),
  ).toEqual(next);
});
it('uses scene-space thresholds at the tutor zoom', () => {
  expect(
    resolveWhiteboardFollow(
      { ...original, zoom: 2 },
      { ...original, zoom: 2, writing: { x: 50, y: 0 } },
      { ...original, zoom: 2 },
      { width: 390, height: 600 },
    ).centerX,
  ).toBe(50);
});
it('animates to the exact target and cancels when the participant starts interacting', () => {
  const frames: Array<(time: number) => void> = [];
  let blocked = false;
  const apply = vi.fn();
  const cancel = vi.fn();
  const dispose = animateWhiteboardFollow(
    original,
    { centerX: 200, centerY: 300, zoom: 2 },
    apply,
    {
      request: (callback) => {
        frames.push(callback);
        return frames.length;
      },
      cancel,
      blocked: () => blocked,
      reducedMotion: false,
    },
  );
  frames.shift()!(0);
  frames.shift()!(110);
  expect(apply.mock.calls[apply.mock.calls.length - 1]?.[0].centerX).toBeGreaterThan(100);
  blocked = true;
  frames.shift()!(220);
  expect(apply).toHaveBeenCalledTimes(2);
  dispose();
  expect(cancel).toHaveBeenCalled();
});
it('applies directly with reduced motion and leaves an active stroke alone', () => {
  const apply = vi.fn(),
    request = vi.fn();
  const runtime = { request, cancel: vi.fn(), blocked: () => false, reducedMotion: true };
  animateWhiteboardFollow(
    original,
    { centerX: 100, centerY: 200, zoom: 2 },
    apply,
    runtime,
  );
  expect(apply).toHaveBeenCalledWith({ centerX: 100, centerY: 200, zoom: 2 });
  expect(request).not.toHaveBeenCalled();
  apply.mockClear();
  animateWhiteboardFollow(original, original, apply, { ...runtime, blocked: () => true });
  expect(apply).not.toHaveBeenCalled();
});
