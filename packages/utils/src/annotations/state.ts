import type {
  AnnotationCommit,
  AnnotationSnapshot,
  AnnotationObject,
  AnnotationPoint,
} from '@iconicedu/shared-types';
/** A newer tombstone must never be resurrected by a delayed create/update. */
export function applyAnnotationCommit(
  snapshot: AnnotationSnapshot,
  event: AnnotationCommit,
): AnnotationSnapshot {
  if (
    snapshot.ended ||
    event.roomId !== snapshot.roomId ||
    event.revision <= snapshot.revision
  )
    return snapshot;
  const objects = new Map(snapshot.objects.map((object) => [object.id, object]));
  for (const object of event.objects) {
    if (object.version > (objects.get(object.id)?.version ?? 0))
      objects.set(object.id, object);
  }
  return {
    ...snapshot,
    revision: event.revision,
    objects: event.ended ? [] : [...objects.values()],
    studentsEnabled: event.studentsEnabled,
    ended: event.ended,
  };
}
export class AnnotationStrokeBuffer {
  private packets = new Map<number, AnnotationPoint[]>();
  private sequence = 1;
  private points: AnnotationPoint[];
  constructor(start: AnnotationPoint[]) {
    this.points = [...start];
  }
  append(sequence: number, points: AnnotationPoint[]) {
    if (
      !Number.isInteger(sequence) ||
      sequence < this.sequence ||
      sequence > this.sequence + 128 ||
      this.packets.has(sequence)
    )
      return this.points;
    this.packets.set(sequence, points);
    while (this.packets.has(this.sequence)) {
      this.points.push(...this.packets.get(this.sequence)!);
      this.packets.delete(this.sequence++);
      if (this.points.length > 5000) {
        this.points.length = 5000;
        break;
      }
    }
    return [...this.points];
  }
}
export function moveAnnotation(
  object: AnnotationObject,
  dx: number,
  dy: number,
): AnnotationObject {
  const xs = object.points.map((p) => p.x);
  const ys = object.points.map((p) => p.y);
  const x = Math.max(-Math.min(...xs), Math.min(1 - Math.max(...xs), dx));
  const y = Math.max(-Math.min(...ys), Math.min(1 - Math.max(...ys), dy));
  return {
    ...object,
    points: object.points.map((p) => ({ ...p, x: p.x + x, y: p.y + y })),
  };
}
