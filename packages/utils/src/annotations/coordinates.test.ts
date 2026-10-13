import { describe, expect, it } from 'vitest';
import { AnnotationCoordinateService, simplifyAnnotationPoints } from './coordinates';
describe('annotation coordinates', () => {
  it('excludes letterboxing from portrait and landscape viewers', () => {
    const service = new AnnotationCoordinateService({ width: 1920, height: 1080 });
    expect(service.getContentBounds({ width: 1024, height: 768 })).toEqual({
      x: 0,
      y: 96,
      width: 1024,
      height: 576,
    });
    expect(service.getContentBounds({ width: 1920, height: 600 })).toEqual({
      x: (1920 - (600 * 16) / 9) / 2,
      y: 0,
      width: (600 * 16) / 9,
      height: 600,
    });
  });
  it('normalizes transformed client rectangles without multiplying by device pixel ratio', () => {
    const service = new AnnotationCoordinateService({ width: 1000, height: 500 });
    expect(
      service.clientToNormalized(
        { x: 450, y: 300, pressure: 0.7 },
        { left: 50, top: 100, width: 800, height: 400 },
      ),
    ).toEqual({ x: 0.5, y: 0.5, pressure: 0.7 });
    expect(
      service.normalizedToStage({ x: 0.5, y: 0.5 }, { width: 1000, height: 500 }),
    ).toEqual({ x: 500, y: 250 });
    expect(
      service.clientToNormalized(
        { x: 0, y: 0 },
        { left: 50, top: 100, width: 800, height: 400 },
      ),
    ).toBeNull();
    expect(service.stageToNormalized({ x: 1, y: 1 }, { width: 0, height: 0 })).toBeNull();
  });
  it('simplifies straight paths while retaining endpoints and bends', () => {
    expect(
      simplifyAnnotationPoints([
        { x: 0, y: 0 },
        { x: 0.25, y: 0.25 },
        { x: 0.5, y: 0.5 },
        { x: 1, y: 1 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
    expect(
      simplifyAnnotationPoints([
        { x: 0, y: 0 },
        { x: 0.5, y: 1 },
        { x: 1, y: 0 },
      ]),
    ).toHaveLength(3);
  });
});
