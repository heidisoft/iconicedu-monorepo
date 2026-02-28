import { describe, expect, it } from 'vitest';

import { applyInlineFormat } from './message-input-formatting.utils';

describe('applyInlineFormat', () => {
  it('wraps selected text with the requested marker', () => {
    expect(applyInlineFormat('hello world', 6, 11, '**')).toEqual({
      nextValue: 'hello **world**',
      selectionStart: 8,
      selectionEnd: 13,
    });
  });

  it('inserts paired markers and places the caret between them when nothing is selected', () => {
    expect(applyInlineFormat('hello', 5, 5, '*')).toEqual({
      nextValue: 'hello**',
      selectionStart: 6,
      selectionEnd: 6,
    });
  });
});
