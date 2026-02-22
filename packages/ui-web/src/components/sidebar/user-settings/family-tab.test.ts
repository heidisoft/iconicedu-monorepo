import { describe, expect, it } from 'vitest';

import { buildCollapsedChildSectionState } from './family-tab';

describe('buildCollapsedChildSectionState', () => {
  it('keeps previously tracked sections and closes the created child section', () => {
    const previous = {
      'child-a': true,
      'child-b': false,
    };

    const next = buildCollapsedChildSectionState(previous, 'child-c');

    expect(next).toEqual({
      'child-a': true,
      'child-b': false,
      'child-c': false,
    });
  });
});
