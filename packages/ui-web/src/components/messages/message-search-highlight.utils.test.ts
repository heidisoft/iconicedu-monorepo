import { describe, expect, it } from 'vitest';
import { splitTextByMatchRanges } from './message-search-highlight.utils';

describe('splitTextByMatchRanges', () => {
  it('returns the whole text unhighlighted when there are no ranges', () => {
    expect(splitTextByMatchRanges('hello world', [])).toEqual([
      { text: 'hello world', highlighted: false },
    ]);
  });

  it('returns nothing for empty text', () => {
    expect(splitTextByMatchRanges('', [{ start: 0, end: 1 }])).toEqual([]);
  });

  it('highlights a single match in the middle', () => {
    expect(splitTextByMatchRanges('hello world', [{ start: 6, end: 11 }])).toEqual([
      { text: 'hello ', highlighted: false },
      { text: 'world', highlighted: true },
    ]);
  });

  it('highlights a match at the very start', () => {
    expect(splitTextByMatchRanges('hello world', [{ start: 0, end: 5 }])).toEqual([
      { text: 'hello', highlighted: true },
      { text: ' world', highlighted: false },
    ]);
  });

  it('highlights multiple non-overlapping matches', () => {
    expect(
      splitTextByMatchRanges('cat and dog and cat', [
        { start: 0, end: 3 },
        { start: 16, end: 19 },
      ]),
    ).toEqual([
      { text: 'cat', highlighted: true },
      { text: ' and dog and ', highlighted: false },
      { text: 'cat', highlighted: true },
    ]);
  });

  it('merges overlapping ranges instead of double-highlighting', () => {
    expect(
      splitTextByMatchRanges('abcdef', [
        { start: 0, end: 3 },
        { start: 2, end: 5 },
      ]),
    ).toEqual([
      { text: 'abcde', highlighted: true },
      { text: 'f', highlighted: false },
    ]);
  });

  it('sorts out-of-order ranges before splitting', () => {
    expect(
      splitTextByMatchRanges('abcdef', [
        { start: 4, end: 6 },
        { start: 0, end: 2 },
      ]),
    ).toEqual([
      { text: 'ab', highlighted: true },
      { text: 'cd', highlighted: false },
      { text: 'ef', highlighted: true },
    ]);
  });

  it('clamps ranges that exceed the text bounds', () => {
    expect(splitTextByMatchRanges('short', [{ start: 3, end: 100 }])).toEqual([
      { text: 'sho', highlighted: false },
      { text: 'rt', highlighted: true },
    ]);
  });

  it('ignores empty or inverted ranges', () => {
    expect(splitTextByMatchRanges('hello', [{ start: 3, end: 3 }])).toEqual([
      { text: 'hello', highlighted: false },
    ]);
  });
});
