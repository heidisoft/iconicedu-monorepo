import { describe, expect, it } from 'vitest';

import { applyInlineFormat, applyListFormat } from './message-input-formatting.utils';

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

describe('applyListFormat', () => {
  it('prefixes an empty selection line with a bullet marker', () => {
    expect(applyListFormat('', 0, 0, 'bullet')).toEqual({
      nextValue: '- ',
      selectionStart: 2,
      selectionEnd: 2,
    });
  });

  it('prefixes an empty selection line with a numbered marker', () => {
    expect(applyListFormat('', 0, 0, 'numbered')).toEqual({
      nextValue: '1. ',
      selectionStart: 3,
      selectionEnd: 3,
    });
  });

  it('bullets every line covered by a multi-line selection', () => {
    const value = 'milk\neggs\nbread';
    const result = applyListFormat(value, 0, value.length, 'bullet');

    expect(result.nextValue).toBe('- milk\n- eggs\n- bread');
    expect(result.selectionStart).toBe(result.selectionEnd);
    expect(result.selectionStart).toBe(result.nextValue.length);
  });

  it('numbers every line covered by a multi-line selection, incrementing per line', () => {
    const value = 'milk\neggs\nbread';
    const result = applyListFormat(value, 0, value.length, 'numbered');

    expect(result.nextValue).toBe('1. milk\n2. eggs\n3. bread');
  });

  it('expands a partial-line selection to format the whole line', () => {
    const value = 'buy milk and eggs';
    // selection only covers "milk"
    const result = applyListFormat(value, 4, 8, 'bullet');

    expect(result.nextValue).toBe('- buy milk and eggs');
  });

  it('only reformats the lines touched by the selection, leaving surrounding lines untouched', () => {
    const value = 'intro line\nmilk\neggs\noutro line';
    const selectionStart = value.indexOf('milk');
    const selectionEnd = value.indexOf('eggs') + 'eggs'.length;

    const result = applyListFormat(value, selectionStart, selectionEnd, 'numbered');

    expect(result.nextValue).toBe('intro line\n1. milk\n2. eggs\noutro line');
  });
});
