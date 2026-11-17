import type { AnnotationObject, AnnotationPoint } from '@iconicedu/shared-types';
export function nativeAnnotationBounds(
  object: AnnotationObject,
  width: number,
  height: number,
) {
  const xs = object.points.map((point) => point.x * width),
    ys = object.points.map((point) => point.y * height);
  const x = Math.min(...xs),
    y = Math.min(...ys);
  const font = (object.style.fontSize * width) / 1000;
  const text = object.type === 'text' || object.type.startsWith('stamp');
  return {
    x,
    y,
    width: Math.max(
      1,
      Math.max(...xs) - x,
      text ? font * Math.max(1, object.text?.length ?? 2) * 0.6 : 0,
    ),
    height: Math.max(1, Math.max(...ys) - y, text ? font * 1.3 : 0),
  };
}
export function hitNativeAnnotation(
  object: AnnotationObject,
  point: AnnotationPoint,
  width: number,
  height: number,
) {
  if (object.deleted || !object.points.length) return false;
  const box = nativeAnnotationBounds(object, width, height);
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  const angle = (-object.rotation * Math.PI) / 180;
  const dx = point.x * width - cx,
    dy = point.y * height - cy;
  const x = cx + dx * Math.cos(angle) - dy * Math.sin(angle),
    y = cy + dx * Math.sin(angle) + dy * Math.cos(angle);
  return (
    x >= box.x - 12 &&
    x <= box.x + box.width + 12 &&
    y >= box.y - 12 &&
    y <= box.y + box.height + 12
  );
}
export function scaleNativeAnnotation(
  object: AnnotationObject,
  factor: number,
): AnnotationObject {
  const xs = object.points.map((point) => point.x),
    ys = object.points.map((point) => point.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2,
    cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return {
    ...object,
    points: object.points.map((point) => ({
      ...point,
      x: Math.max(0, Math.min(1, cx + (point.x - cx) * factor)),
      y: Math.max(0, Math.min(1, cy + (point.y - cy) * factor)),
    })),
    style: {
      ...object.style,
      fontSize: Math.max(12, Math.min(96, object.style.fontSize * factor)),
    },
  };
}
