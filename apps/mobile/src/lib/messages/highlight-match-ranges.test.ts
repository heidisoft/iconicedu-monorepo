import { splitTextByMatchRanges } from './highlight-match-ranges';

describe('splitTextByMatchRanges', () => {
  it('returns the whole text unmatched when there are no ranges', () => {
    expect(splitTextByMatchRanges('hello world', [])).toEqual([
      { text: 'hello world', matched: false },
    ]);
    expect(splitTextByMatchRanges('hello world', undefined)).toEqual([
      { text: 'hello world', matched: false },
    ]);
  });

  it('returns an empty array for empty text', () => {
    expect(splitTextByMatchRanges('', [{ start: 0, end: 1 }])).toEqual([]);
  });

  it('splits a single match in the middle of the text', () => {
    const segments = splitTextByMatchRanges('hello world', [{ start: 6, end: 11 }]);
    expect(segments).toEqual([
      { text: 'hello ', matched: false },
      { text: 'world', matched: true },
    ]);
  });

  it('handles a match at the very start', () => {
    const segments = splitTextByMatchRanges('hello world', [{ start: 0, end: 5 }]);
    expect(segments).toEqual([
      { text: 'hello', matched: true },
      { text: ' world', matched: false },
    ]);
  });

  it('handles multiple non-overlapping matches', () => {
    const segments = splitTextByMatchRanges('the cat sat on the mat', [
      { start: 4, end: 7 },
      { start: 19, end: 22 },
    ]);
    expect(segments).toEqual([
      { text: 'the ', matched: false },
      { text: 'cat', matched: true },
      { text: ' sat on the ', matched: false },
      { text: 'mat', matched: true },
    ]);
  });

  it('merges overlapping or out-of-order ranges', () => {
    const segments = splitTextByMatchRanges('abcdef', [
      { start: 3, end: 5 },
      { start: 0, end: 2 },
      { start: 1, end: 4 },
    ]);
    // [0,2) and [1,4) merge to [0,4); then [3,5) merges into that -> [0,5)
    expect(segments).toEqual([
      { text: 'abcde', matched: true },
      { text: 'f', matched: false },
    ]);
  });

  it('clamps ranges that exceed text bounds', () => {
    const segments = splitTextByMatchRanges('short', [{ start: 2, end: 999 }]);
    expect(segments).toEqual([
      { text: 'sh', matched: false },
      { text: 'ort', matched: true },
    ]);
  });

  it('drops degenerate/invalid ranges', () => {
    const segments = splitTextByMatchRanges('short', [{ start: 5, end: 2 }]);
    expect(segments).toEqual([{ text: 'short', matched: false }]);
  });
});
