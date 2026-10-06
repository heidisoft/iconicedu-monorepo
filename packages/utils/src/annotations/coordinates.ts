import type { AnnotationPoint } from '@iconicedu/shared-types';
export type AnnotationBounds = { x: number; y: number; width: number; height: number };
/** CSS pixels only: Konva handles backing-store devicePixelRatio independently. */
export class AnnotationCoordinateService {
  constructor(private readonly source: { width: number; height: number }) {}
  getContentBounds(container: { width: number; height: number }): AnnotationBounds {
    if (
      this.source.width <= 0 ||
      this.source.height <= 0 ||
      container.width <= 0 ||
      container.height <= 0
    )
      return { x: 0, y: 0, width: 0, height: 0 };
    const scale = Math.min(
      container.width / this.source.width,
      container.height / this.source.height,
    );
    const width = Math.min(container.width, this.source.width * scale);
    const height = Math.min(container.height, this.source.height * scale);
    return {
      x: (container.width - width) / 2,
      y: (container.height - height) / 2,
      width,
      height,
    };
  }
  clientToNormalized(
    point: AnnotationPoint,
    rect: { left: number; top: number; width: number; height: number },
  ): AnnotationPoint | null {
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = (point.x - rect.left) / rect.width;
    const y = (point.y - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return {
      x,
      y,
      ...(point.pressure === undefined ? {} : { pressure: point.pressure }),
    };
  }
  normalizedToStage(
    point: AnnotationPoint,
    size: { width: number; height: number },
  ): AnnotationPoint {
    return { x: point.x * size.width, y: point.y * size.height };
  }
  stageToNormalized(
    point: AnnotationPoint,
    size: { width: number; height: number },
  ): AnnotationPoint | null {
    return this.clientToNormalized(point, { left: 0, top: 0, ...size });
  }
}
/** Ramer–Douglas–Peucker, iterative to avoid stack overflow on long strokes. */
export function simplifyAnnotationPoints(
  points: AnnotationPoint[],
  tolerance = 0.0005,
): AnnotationPoint[] {
  if (points.length <= 2) return points;
  const keep = new Set([0, points.length - 1]);
  const pending = [[0, points.length - 1]];
  while (pending.length) {
    const [start, end] = pending.pop()!;
    const a = points[start];
    const b = points[end];
    let largest = tolerance * tolerance;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const p = points[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const t =
        dx || dy
          ? Math.max(
              0,
              Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)),
            )
          : 0;
      const distance = (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2;
      if (distance > largest) {
        largest = distance;
        index = i;
      }
    }
    if (index !== -1) {
      keep.add(index);
      pending.push([start, index], [index, end]);
    }
  }
  return [...keep].sort((a, b) => a - b).map((index) => points[index]);
}
