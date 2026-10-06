import { validateExcalidrawPayload } from './excalidraw-scene-validation';
const shape = {
  id: 'shape',
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  angle: 0,
};
describe('canvas scene codec', () => {
  it('accepts basic shapes, text and bounded freehand points', () => {
    for (const data of [
      shape,
      {
        ...shape,
        type: 'freedraw',
        points: [
          [0, 0],
          [10, 10],
        ],
        pressures: [0.5, 0.7],
      },
      { ...shape, type: 'text', text: 'Math', fontSize: 20, fontFamily: 2 },
    ])
      expect(() => validateExcalidrawPayload(data)).not.toThrow();
  });
  it('rejects malformed scenes before they can affect other participants', () => {
    for (const data of [
      { ...shape, type: 'freedraw', points: [null] },
      { ...shape, type: 'freedraw', points: [[Infinity, 0]] },
      { ...shape, type: 'text', text: { html: 'bad' }, fontSize: 20, fontFamily: 2 },
      { ...shape, opacity: NaN },
      { ...shape, boundElements: [null] },
      { ...shape, groupIds: [{}] },
      { ...shape, type: 'freedraw', points: [[0, 0]], pressures: [2] },
    ])
      expect(() => validateExcalidrawPayload(data)).toThrow();
  });
});
