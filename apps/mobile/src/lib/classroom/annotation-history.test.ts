import type {
  AnnotationObject,
  AnnotationSnapshot,
  AnnotationCommit,
} from '@iconicedu/shared-types';
import { NativeAnnotationHistory } from './annotation-history';
import { hitNativeAnnotation, scaleNativeAnnotation } from './annotation-geometry';
const object: AnnotationObject = {
  id: 'one',
  roomId: 'room',
  shareSessionId: 'room',
  type: 'rectangle',
  creatorId: 'user',
  creatorName: 'Test',
  creatorRole: 'student',
  points: [
    { x: 0.2, y: 0.2 },
    { x: 0.4, y: 0.4 },
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
const snapshot = (objects: AnnotationObject[]): AnnotationSnapshot => ({
  schemaVersion: 1,
  roomId: 'room',
  shareSessionId: 'room',
  revision: 1,
  studentsEnabled: true,
  ended: false,
  objects,
});
const commit = (objects: AnnotationObject[]): AnnotationCommit => ({
  eventId: 'event',
  roomId: 'room',
  revision: 2,
  studentsEnabled: true,
  ended: false,
  objects,
});
describe('native annotation editing history', () => {
  it('undoes creation and redoes it using the current tombstone version', () => {
    const history = new NativeAnnotationHistory();
    history.record(
      [],
      { eventId: 'new', kind: 'put', object, baseVersion: 0 },
      commit([object]),
    );
    const undo = history.prepare('undo', snapshot([object]))!;
    expect(undo.operations).toEqual([
      { eventId: '', kind: 'delete', id: 'one', baseVersion: 1 },
    ]);
    const deleted = { ...object, deleted: true, version: 2 };
    history.complete(undo, [commit([deleted])]);
    const redo = history.prepare('redo', snapshot([deleted]))!;
    expect(redo.operations[0]).toMatchObject({
      kind: 'put',
      baseVersion: 2,
      object: { deleted: false, version: 3 },
    });
  });
  it('keeps successive local edits undoable after provider version increments', () => {
    const history = new NativeAnnotationHistory();
    history.record(
      [],
      { eventId: 'new', kind: 'put', object, baseVersion: 0 },
      commit([object]),
    );
    const edited = { ...object, rotation: 45, version: 2 };
    history.record(
      [object],
      { eventId: 'edit', kind: 'put', object: edited, baseVersion: 1 },
      commit([edited]),
    );
    const plan = history.prepare('undo', snapshot([edited]))!;
    const restored = { ...object, version: 3 };
    history.complete(plan, [commit([restored])]);
    expect(history.prepare('undo', snapshot([restored]))!.operations[0]).toMatchObject({
      kind: 'delete',
      baseVersion: 3,
    });
  });
  it('refuses to overwrite a newer edit from another participant', () => {
    const history = new NativeAnnotationHistory();
    history.record(
      [],
      { eventId: 'new', kind: 'put', object, baseVersion: 0 },
      commit([object]),
    );
    expect(() => history.prepare('undo', snapshot([{ ...object, version: 2 }]))).toThrow(
      'another device',
    );
    expect(history.counts.undo).toBe(0);
  });
  it('restores all objects from a clear action and clears redo after a new action', () => {
    const history = new NativeAnnotationHistory();
    const second = { ...object, id: 'two' };
    const deleted = [object, second].map((value) => ({
      ...value,
      deleted: true,
      version: 2,
    }));
    history.record(
      [object, second],
      { eventId: 'clear', kind: 'clear', scope: 'mine' },
      commit(deleted),
    );
    const plan = history.prepare('undo', snapshot(deleted))!;
    expect(plan.operations).toHaveLength(2);
    history.complete(plan, [
      commit([
        { ...object, version: 3 },
        { ...second, version: 3 },
      ]),
    ]);
    history.record(
      [],
      { eventId: 'new', kind: 'put', object, baseVersion: 0 },
      commit([object]),
    );
    expect(history.counts.redo).toBe(0);
  });
});
describe('native annotation geometry', () => {
  it('selects rotated objects in display coordinates and ignores tombstones', () => {
    expect(
      hitNativeAnnotation({ ...object, rotation: 90 }, { x: 0.3, y: 0.3 }, 1000, 500),
    ).toBe(true);
    expect(
      hitNativeAnnotation({ ...object, deleted: true }, { x: 0.3, y: 0.3 }, 1000, 500),
    ).toBe(false);
    expect(hitNativeAnnotation(object, { x: 0.9, y: 0.9 }, 1000, 500)).toBe(false);
  });
  it('resizes within normalized content bounds', () => {
    const enlarged = scaleNativeAnnotation(object, 20);
    expect(
      enlarged.points.every(
        (point) => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1,
      ),
    ).toBe(true);
    expect(enlarged.style.fontSize).toBe(96);
  });
});
