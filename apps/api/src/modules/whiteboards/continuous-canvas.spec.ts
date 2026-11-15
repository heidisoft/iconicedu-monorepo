import type { WhiteboardDocumentVM, WhiteboardElementVM } from '@iconicedu/shared-types';
import { continuousCanvas } from './continuous-canvas';
import { applyWhiteboardOperation } from './whiteboard-document';

const element = (id: string, y = 0): WhiteboardElementVM => ({
  id,
  version: 1,
  nonce: 1,
  deleted: false,
  data: { id, type: 'rectangle', x: 10, y, width: 100, height: 40, angle: 0 },
});
const legacy = (): WhiteboardDocumentVM => ({
  schemaVersion: 1,
  studentEditing: false,
  presenting: true,
  pages: [
    { id: 'first', title: 'One', elements: [element('same')] },
    {
      id: 'second',
      title: 'Two',
      elements: [
        {
          ...element('same', 20),
          data: {
            ...element('same', 20).data,
            groupIds: ['group'],
            boundElements: [{ id: 'label', type: 'text' }],
          },
        },
        {
          ...element('label', 30),
          deleted: true,
          data: {
            ...element('label', 30).data,
            containerId: 'same',
            frameId: 'same',
            startBinding: { elementId: 'same' },
          },
        },
      ],
    },
  ],
});
describe('infinite canvas compatibility', () => {
  it('retains old pages, separates duplicate IDs and preserves bindings and relative geometry', () => {
    const source = legacy();
    const result = continuousCanvas(source);
    expect(result.layout).toBe('infinite');
    expect(result.pages).toHaveLength(1);
    expect(result.studentEditing).toBe(false);
    expect(result.presenting).toBe(true);
    const [original, shape, label] = result.pages[0].elements;
    expect(original).toEqual(source.pages[0].elements[0]);
    expect(shape.id).not.toBe(original.id);
    expect(shape.data.y).toBe(200);
    expect(Number(label.data.y) - Number(shape.data.y)).toBe(10);
    expect(label.deleted).toBe(true);
    expect(label.data.containerId).toBe(shape.id);
    expect(label.data.frameId).toBe(shape.id);
    expect(label.data.startBinding).toEqual({ elementId: shape.id });
    expect(shape.data.boundElements).toEqual([{ id: label.id, type: 'text' }]);
    expect(source.pages).toHaveLength(2);
    expect(continuousCanvas(result)).toEqual(result);
  });
  it('translates queued legacy edits consistently after the normalized layout is saved', () => {
    const document = continuousCanvas(legacy());
    const update = element('same', 50);
    update.version = 2;
    const updated = applyWhiteboardOperation(
      document,
      { id: 'queued', type: 'elements', pageId: 'second', elements: [update] },
      'teacher',
    );
    expect(updated.pages[0].elements).toHaveLength(3);
    expect(updated.pages[0].elements[1].id).toBe(document.pages[0].elements[1].id);
    expect(updated.pages[0].elements[1].data.y).toBe(230);
    expect(updated.pages[0].elements[0]).toEqual(document.pages[0].elements[0]);
    expect(
      applyWhiteboardOperation(
        updated,
        { id: 'retry', type: 'elements', pageId: 'second', elements: [update] },
        'teacher',
      ),
    ).toEqual(updated);
    expect(() =>
      applyWhiteboardOperation(
        document,
        { id: 'clear', type: 'clear-page', pageId: 'second' },
        'teacher',
      ),
    ).toThrow('Rejoin');
  });
});
