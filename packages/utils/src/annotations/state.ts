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
  if (snapshot.ended || event.roomId !== snapshot.roomId) return snapshot;
  // Commits contain deltas: an older room revision can still carry an unseen stroke.
  const newer = event.revision > snapshot.revision;
  let changed = false;
  const objects = new Map(snapshot.objects.map((object) => [object.id, object]));
  for (const object of event.objects) {
    if (object.version > (objects.get(object.id)?.version ?? 0)) {
      objects.set(object.id, object);
      changed = true;
    }
  }
  if (!newer && !changed) return snapshot;
  return {
    ...snapshot,
    revision: Math.max(snapshot.revision, event.revision),
    objects: newer && event.ended ? [] : [...objects.values()],
    studentsEnabled: newer ? event.studentsEnabled : snapshot.studentsEnabled,
    ended: newer ? event.ended : snapshot.ended,
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

/** Subtle participant labels retain identity without competing with the drawing. */
export function participantCursorColors(color: string) {
  const hex = /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1) : '475569';
  const channels = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const blend = (amount: number) =>
    '#' +
    channels
      .map((value) =>
        Math.round(value * (1 - amount) + 255 * amount)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');
  return {
    background: blend(0.9),
    foreground:
      '#' +
      channels
        .map((value) =>
          Math.round(value * 0.45)
            .toString(16)
            .padStart(2, '0'),
        )
        .join(''),
  };
}
