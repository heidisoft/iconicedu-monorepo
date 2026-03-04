import { describe, expect, it } from 'vitest';

import { createEnumNormalizer, groupBy } from './index';

describe('@iconicedu/utils', () => {
  it('groups rows by key', () => {
    const grouped = groupBy(
      [
        { id: '1', kind: 'a' },
        { id: '2', kind: 'b' },
        { id: '3', kind: 'a' },
      ],
      (row) => row.kind,
    );

    expect(grouped.get('a')).toEqual([
      { id: '1', kind: 'a' },
      { id: '3', kind: 'a' },
    ]);
    expect(grouped.get('b')).toEqual([{ id: '2', kind: 'b' }]);
  });

  it('normalizes allowed enum values and rejects unknown values', () => {
    const normalize = createEnumNormalizer(['one', 'two'] as const);

    expect(normalize('one')).toBe('one');
    expect(normalize('three')).toBeNull();
    expect(normalize(null)).toBeNull();
  });
});
