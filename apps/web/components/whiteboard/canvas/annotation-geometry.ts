export type Point = [number, number];
export function insidePolygon([x, y]: Point, polygon: Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i],
      [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
/** Clip each line segment against a circular eraser, retaining the outside paths. */
export function eraseStroke(points: Point[], center: Point, radius: number): Point[][] {
  const intersects = points.some((point, i) => {
    const end = points[i + 1] ?? point;
    const dx = end[0] - point[0],
      dy = end[1] - point[1];
    const length = dx * dx + dy * dy;
    const t = length
      ? Math.max(
          0,
          Math.min(
            1,
            ((center[0] - point[0]) * dx + (center[1] - point[1]) * dy) / length,
          ),
        )
      : 0;
    return (
      Math.hypot(point[0] + t * dx - center[0], point[1] + t * dy - center[1]) < radius
    );
  });
  if (!intersects) return [points];
  const paths: Point[][] = [];
  let path: Point[] = [];
  const outside = ([x, y]: Point) => Math.hypot(x - center[0], y - center[1]) >= radius;
  const append = (p: Point) => {
    if (
      !path.length ||
      Math.hypot(p[0] - path[path.length - 1][0], p[1] - path[path.length - 1][1]) > 1e-6
    )
      path.push(p);
  };
  const flush = () => {
    if (path.length > 1) paths.push(path);
    path = [];
  };
  if (points.length === 1) return outside(points[0]) ? [points] : [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      ox = a[0] - center[0],
      oy = a[1] - center[1];
    const aa = dx * dx + dy * dy,
      bb = 2 * (ox * dx + oy * dy),
      cc = ox * ox + oy * oy - radius * radius;
    const cuts = [0, 1],
      discriminant = bb * bb - 4 * aa * cc;
    if (aa > 0 && discriminant > 0) {
      for (const t of [
        (-bb - Math.sqrt(discriminant)) / (2 * aa),
        (-bb + Math.sqrt(discriminant)) / (2 * aa),
      ])
        if (t > 0 && t < 1) cuts.push(t);
    }
    cuts.sort((a, b) => a - b);
    const at = (t: number): Point => [a[0] + t * dx, a[1] + t * dy];
    for (let j = 1; j < cuts.length; j++) {
      if (outside(at((cuts[j - 1] + cuts[j]) / 2))) {
        append(at(cuts[j - 1]));
        append(at(cuts[j]));
      } else flush();
    }
  }
  flush();
  return paths;
}
