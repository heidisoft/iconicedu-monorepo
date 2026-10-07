import { describe, it, expect } from 'vitest';
import { eraseStroke, insidePolygon } from './annotation-geometry';
describe('meeting annotation geometry', () => {
  it('splits a long segment at the eraser boundary instead of deleting the whole stroke', () => {
    expect(
      eraseStroke(
        [
          [0, 0],
          [100, 0],
        ],
        [50, 0],
        10,
      ),
    ).toEqual([
      [
        [0, 0],
        [40, 0],
      ],
      [
        [60, 0],
        [100, 0],
      ],
    ]);
  });
  it('preserves untouched points and handles complete erasure and isolated dots', () => {
    expect(
      eraseStroke(
        [
          [0, 0],
          [0, 0],
          [10, 10],
        ],
        [100, 100],
        5,
      ),
    ).toEqual([
      [
        [0, 0],
        [0, 0],
        [10, 10],
      ],
    ]);
    expect(
      eraseStroke(
        [
          [0, 0],
          [10, 0],
        ],
        [5, 0],
        20,
      ),
    ).toEqual([]);
    expect(eraseStroke([[0, 0]], [0, 0], 5)).toEqual([]);
    expect(eraseStroke([[0, 0]], [100, 100], 5)).toEqual([[[0, 0]]]);
  });
  it('selects inside a concave lasso without selecting the cutout', () => {
    const polygon: [number, number][] = [
      [0, 0],
      [100, 0],
      [100, 30],
      [30, 30],
      [30, 100],
      [0, 100],
    ];
    expect(insidePolygon([10, 70], polygon)).toBe(true);
    expect(insidePolygon([70, 70], polygon)).toBe(false);
  });
});
