import { describe, it, expect } from 'vitest';
import { educationalAssets, WhiteboardAssetRegistry, createBarChart } from './registry';
describe('educational assets', () => {
  it('searches and loads insertable Math primitives', () => {
    expect(educationalAssets.categories()).toContain('Math');
    expect(educationalAssets.search('axis')[0].name).toBe('Coordinate plane');
    for (const id of ['math-coordinate-plane', 'math-number-line', 'math-graph-paper'])
      expect(educationalAssets.get(id).primitives.length).toBeGreaterThan(10);
  });
  it('registers new categories and charts without changing the adapter', () => {
    const registry = new WhiteboardAssetRegistry();
    registry.register(createBarChart('chart', [{ label: 'A', value: 3 }]));
    expect(registry.categories()).toEqual(['Charts']);
    expect(registry.search('data')).toHaveLength(1);
    expect(() => registry.get('bad')).toThrow();
    expect(() => createBarChart('bad', [])).toThrow();
    expect(() =>
      registry.register(createBarChart('chart', [{ label: 'A', value: 1 }])),
    ).toThrow();
  });
});
