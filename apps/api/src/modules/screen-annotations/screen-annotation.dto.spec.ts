import {
  parseAnnotationOperation,
  parseAnnotationPointer,
} from './screen-annotation.dto';
const id = '10000000-0000-4000-8000-000000000001';
const input = {
  eventId: id,
  kind: 'put',
  baseVersion: 0,
  object: {
    id,
    type: 'pen',
    creatorId: 'spoofed-host',
    points: [{ x: 0.5, y: 0.5, pressure: 0.8 }],
    rotation: 0,
    style: {
      color: '#ff0000',
      width: 3,
      opacity: 1,
      fontSize: 24,
      bold: false,
      italic: false,
    },
  },
};
describe('annotation operation validation', () => {
  it('strips client identity and metadata before the database assigns ownership', () => {
    const parsed = parseAnnotationOperation(input);
    expect(parsed.kind).toBe('put');
    if (parsed.kind === 'put') {
      expect(parsed.object.creatorId).toBe('');
      expect(parsed.object.version).toBe(0);
    }
  });
  it.each([NaN, Infinity, -0.1, 1.1])('rejects non-normalized coordinate %s', (x) => {
    expect(() =>
      parseAnnotationOperation({
        ...input,
        object: { ...input.object, points: [{ x, y: 0.5 }] },
      }),
    ).toThrow();
  });
  it('rejects ephemeral objects and unbounded paths from persistence', () => {
    expect(() =>
      parseAnnotationOperation({
        ...input,
        object: { ...input.object, type: 'vanishingPen' },
      }),
    ).toThrow();
    expect(() =>
      parseAnnotationOperation({
        ...input,
        object: {
          ...input.object,
          points: Array.from({ length: 5001 }, () => ({ x: 0, y: 0 })),
        },
      }),
    ).toThrow();
  });
  it('rejects unsafe colors, fractional versions and malformed commands', () => {
    expect(() =>
      parseAnnotationOperation({
        ...input,
        object: {
          ...input.object,
          style: { ...input.object.style, color: 'url(https://example.com)' },
        },
      }),
    ).toThrow();
    expect(() => parseAnnotationOperation({ ...input, baseVersion: 0.5 })).toThrow();
    expect(() =>
      parseAnnotationOperation({ eventId: id, kind: 'permissions', enabled: 'true' }),
    ).toThrow();
    expect(() =>
      parseAnnotationOperation({ eventId: id, kind: 'clear', scope: 'everyone' }),
    ).toThrow();
  });
});

describe('ephemeral pointer validation', () => {
  it('strips client-supplied identities and names', () => {
    expect(
      parseAnnotationPointer({
        point: { x: 0.2, y: 0.3 },
        tool: 'spotlight',
        color: '#16a34a',
        name: 'Spoof',
        userId: 'other',
      }),
    ).toEqual({ point: { x: 0.2, y: 0.3 }, tool: 'spotlight', color: '#16a34a' });
  });
  it.each([NaN, Infinity, -1, 2])('rejects invalid coordinate %s', (x) => {
    expect(() =>
      parseAnnotationPointer({
        point: { x, y: 0.2 },
        tool: 'spotlight',
        color: '#16a34a',
      }),
    ).toThrow();
  });
  it('rejects arbitrary tools and colors', () => {
    expect(() =>
      parseAnnotationPointer({
        point: { x: 0.2, y: 0.2 },
        tool: 'pen',
        color: '#16a34a',
      }),
    ).toThrow();
    expect(() =>
      parseAnnotationPointer({
        point: { x: 0.2, y: 0.2 },
        tool: 'spotlight',
        color: 'invalid',
      }),
    ).toThrow();
  });
});
