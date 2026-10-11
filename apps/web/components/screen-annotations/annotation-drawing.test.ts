import { describe, expect, it } from 'vitest';
import { shapeEndpoint } from './annotation-drawing';
describe('native annotation shape gestures', () => {
  it.each(['rectangle', 'ellipse', 'diamond'] as const)(
    'makes %s square in screen pixels when Shift is held',
    (tool) => {
      const start = { x: 0.5, y: 0.5 };
      const end = shapeEndpoint(tool, start, { x: 0.3, y: 0.4 }, 1000, 500, true);
      expect((start.x - end.x) * 1000).toBeCloseTo((start.y - end.y) * 500);
    },
  );
  it('keeps constrained shapes within content without distorting their ratio', () => {
    const start = { x: 0.9, y: 0.9 };
    const end = shapeEndpoint('rectangle', start, { x: 1, y: 1 }, 1000, 500, true);
    expect(end.y).toBeCloseTo(1);
    expect((end.x - start.x) * 1000).toBeCloseTo((end.y - start.y) * 500);
  });
  it('snaps arrows to 45 degree steps and preserves unconstrained endpoints', () => {
    const start = { x: 0.1, y: 0.1 },
      point = { x: 0.4, y: 0.12 };
    expect(shapeEndpoint('arrow', start, point, 1000, 500, true).y).toBe(start.y);
    expect(shapeEndpoint('rectangle', start, point, 1000, 500, false)).toBe(point);
  });
});
