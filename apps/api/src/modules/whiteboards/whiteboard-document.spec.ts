import {
  applyWhiteboardOperation,
  validateWhiteboardOperation,
} from './whiteboard-document';
import type { WhiteboardDocumentVM, WhiteboardElementVM } from '@iconicedu/shared-types';
const initial = (): WhiteboardDocumentVM => ({
  schemaVersion: 1,
  studentEditing: true,
  pages: [{ id: 'one', title: 'Page 1', elements: [] }],
});
const element = (version = 1, deleted = false): WhiteboardElementVM => ({
  id: 'shape',
  version,
  nonce: 1,
  deleted,
  data: {
    id: 'shape',
    type: 'rectangle',
    version,
    versionNonce: 1,
    isDeleted: deleted,
    x: 0,
    y: 0,
    width: 20,
    height: 20,
    angle: 0,
    link: null,
  },
});
describe('whiteboard document and trust boundary', () => {
  it('replaces page management with a single canvas and clears all its content', () => {
    const doc = applyWhiteboardOperation(
      initial(),
      { id: 'draw', type: 'elements', pageId: 'one', elements: [element()] },
      'teacher',
    );
    expect(doc.layout).toBe('infinite');
    for (const type of ['add-page', 'delete-page', 'reorder-page'] as const) {
      expect(() =>
        applyWhiteboardOperation(
          doc,
          { id: type, type, pageId: 'one', title: 'Copy' },
          'teacher',
        ),
      ).toThrow('infinite canvas');
    }
    const cleared = applyWhiteboardOperation(
      doc,
      { id: 'clear', type: 'clear-page', pageId: 'one' },
      'teacher',
    );
    expect(cleared.pages[0].elements[0].deleted).toBe(true);
    expect(doc.pages[0].elements[0].deleted).toBe(false);
  });
  it('allows students to draw while rejecting page management and locked edits', () => {
    expect(
      applyWhiteboardOperation(
        initial(),
        { id: 'a', type: 'elements', pageId: 'one', elements: [element()] },
        'student',
      ).pages[0].elements,
    ).toHaveLength(1);
    for (const op of [
      { id: 'a', type: 'student-editing' as const, enabled: true },
      { id: 'a', type: 'add-page' as const, pageId: 'two', title: 'two' },
      { id: 'a', type: 'clear-page' as const, pageId: 'one' },
      { id: 'a', type: 'presentation' as const, enabled: true },
    ])
      expect(() => applyWhiteboardOperation(initial(), op, 'student')).toThrow('locked');
    const locked = applyWhiteboardOperation(
      initial(),
      { id: 'a', type: 'student-editing', enabled: false },
      'teacher',
    );
    expect(() =>
      applyWhiteboardOperation(
        locked,
        { id: 'b', type: 'elements', pageId: 'one', elements: [element()] },
        'student',
      ),
    ).toThrow('locked');
    expect(
      applyWhiteboardOperation(
        locked,
        { id: 'b', type: 'elements', pageId: 'one', elements: [element()] },
        'teacher',
      ).pages[0].elements,
    ).toHaveLength(1);
  });
  it('merges disjoint work and ignores duplicate, stale and resurrected element replays', () => {
    const op = {
      id: 'a',
      type: 'elements' as const,
      pageId: 'one',
      elements: [element(3, true)],
    };
    const doc = applyWhiteboardOperation(initial(), op, 'teacher');
    const replay = applyWhiteboardOperation(
      doc,
      { ...op, elements: [element(1)] },
      'teacher',
    );
    expect(replay).toEqual(doc);
    expect(applyWhiteboardOperation(doc, op, 'teacher')).toEqual(doc);
    const other = { ...element(), id: 'other', data: { ...element().data, id: 'other' } };
    expect(
      applyWhiteboardOperation(doc, { ...op, elements: [other] }, 'teacher').pages[0]
        .elements,
    ).toHaveLength(2);
  });
  it('validates canvas payloads and rejects external/iframe/link data', () => {
    const op = { id: 'a', type: 'elements', pageId: 'one', elements: [element()] };
    expect(validateWhiteboardOperation(op)).toEqual(op);
    for (const data of [
      { ...element().data, type: 'iframe' },
      { ...element().data, link: 'https://example.com' },
      { ...element().data, x: Infinity },
    ])
      expect(() =>
        validateWhiteboardOperation({ ...op, elements: [{ ...element(), data }] }),
      ).toThrow();
    expect(() =>
      validateWhiteboardOperation({ id: 'a', type: 'unknown', pageId: 'one' }),
    ).toThrow();
  });
  it('rejects invalid source, missing page, excessive pages and malformed operations', () => {
    expect(() =>
      applyWhiteboardOperation(
        initial(),
        { id: 'a', type: 'add-page', pageId: 'two', title: 'copy', sourceId: 'missing' },
        'teacher',
      ),
    ).toThrow('infinite canvas');
    expect(() =>
      applyWhiteboardOperation(
        initial(),
        { id: 'a', type: 'elements', pageId: 'missing', elements: [] },
        'teacher',
      ),
    ).toThrow('Canvas');
    for (const value of [
      null,
      [],
      { id: 'a', type: 'elements', pageId: 'one', elements: [{}] },
      { id: 'a', type: 'reorder-page', pageId: 'one', beforeId: 1 },
    ])
      expect(() => validateWhiteboardOperation(value)).toThrow();
  });
});
