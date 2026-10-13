import type { AnnotationPoint, AnnotationTool } from '@iconicedu/shared-types';

/** Constrain native shape endpoints in display pixels, including non-square shares. */
export function shapeEndpoint(
  tool: AnnotationTool,
  start: AnnotationPoint,
  point: AnnotationPoint,
  width: number,
  height: number,
  constrained: boolean,
): AnnotationPoint {
  if (!constrained) return point;
  const dx = (point.x - start.x) * width;
  const dy = (point.y - start.y) * height;
  let x = dx,
    y = dy;
  if (tool.startsWith('rectangle') || tool.startsWith('ellipse') || tool === 'diamond') {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    x = (Math.sign(dx) || 1) * side;
    y = (Math.sign(dy) || 1) * side;
  } else if (['line', 'arrow', 'doubleArrow'].includes(tool)) {
    const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    const length = Math.hypot(dx, dy);
    x = Math.cos(angle) * length;
    y = Math.sin(angle) * length;
  } else return point;
  // Shorten at the content edge without distorting the constrained shape.
  const limit = (offset: number, origin: number, size: number) =>
    offset > 0
      ? ((1 - origin) * size) / offset
      : offset < 0
        ? (-origin * size) / offset
        : Infinity;
  const factor = Math.min(1, limit(x, start.x, width), limit(y, start.y, height));
  return {
    ...point,
    x: start.x + (x * factor) / width,
    y: start.y + (y * factor) / height,
  };
}
