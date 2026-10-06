import { describe, expect, it } from 'vitest';
import type { AnnotationObject, AnnotationSnapshot } from '@iconicedu/shared-types';
import { AnnotationStrokeBuffer, applyAnnotationCommit, moveAnnotation } from './state';
const object: AnnotationObject = {
  id: 'one',
  roomId: 'room',
  shareSessionId: 'room',
  type: 'pen',
  creatorId: 'user',
  creatorName: 'Test',
  creatorRole: 'student',
  points: [
    { x: 0.1, y: 0.2 },
    { x: 0.4, y: 0.5 },
  ],
  style: {
    color: '#000000',
    width: 3,
    opacity: 1,
    fontSize: 24,
    bold: false,
    italic: false,
  },
  rotation: 0,
  createdAt: 0,
  updatedAt: 0,
  version: 1,
};
const snapshot: AnnotationSnapshot = {
  schemaVersion: 1,
  roomId: 'room',
  shareSessionId: 'room',
  revision: 0,
  studentsEnabled: true,
  ended: false,
  objects: [object],
};
describe('annotation synchronization', () => {
  it('ignores duplicate, stale and other-room commits and retains tombstones', () => {
    const deletion = {
      eventId: 'event',
      roomId: 'room',
      revision: 2,
      objects: [{ ...object, version: 3, deleted: true }],
      studentsEnabled: false,
      ended: false,
    };
    const deleted = applyAnnotationCommit(snapshot, deletion);
    expect(applyAnnotationCommit(deleted, deletion)).toBe(deleted);
    expect(
      applyAnnotationCommit(deleted, { ...deletion, roomId: 'other', revision: 3 }),
    ).toBe(deleted);
    expect(
      applyAnnotationCommit(deleted, { ...deletion, revision: 3, objects: [object] })
        .objects[0].deleted,
    ).toBe(true);
  });
  it('buffers reordered stroke packets and ignores retransmissions', () => {
    const buffer = new AnnotationStrokeBuffer([{ x: 0, y: 0 }]);
    expect(buffer.append(2, [{ x: 1, y: 1 }])).toHaveLength(1);
    expect(buffer.append(1, [{ x: 0.5, y: 0.5 }])).toEqual([
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 },
    ]);
    expect(buffer.append(1, [{ x: 0.5, y: 0.5 }])).toHaveLength(3);
    expect(buffer.append(500, [{ x: 0, y: 0 }])).toHaveLength(3);
  });
  it('clamps movement as a whole without distorting the object', () => {
    const moved = moveAnnotation(object, 1, -1);
    expect(moved.points).toEqual([
      { x: 0.7, y: 0 },
      { x: 1, y: 0.3 },
    ]);
  });
});
