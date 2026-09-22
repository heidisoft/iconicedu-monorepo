/**
 * Search within messages (issue #264 P2) — maps server-provided, pre-computed
 * `matchRanges` onto a message's plain text so the UI can bold the matched
 * substrings without re-implementing any matching logic itself.
 */

export interface MatchRange {
  start: number;
  end: number;
}

export interface HighlightSegment {
  text: string;
  highlighted: boolean;
}

/**
 * Splits `text` into a sequence of highlighted/non-highlighted segments per
 * `ranges`. Ranges are clamped to the text bounds, sorted, and merged when
 * overlapping or adjacent so rendering never double-highlights or drops
 * characters even if the server sends unsorted/overlapping ranges.
 */
export function splitTextByMatchRanges(
  text: string,
  ranges: MatchRange[] | null | undefined,
): HighlightSegment[] {
  if (!text) {
    return [];
  }
  if (!ranges || ranges.length === 0) {
    return [{ text, highlighted: false }];
  }

  const normalized = ranges
    .map((range) => ({
      start: Math.max(0, Math.min(range.start, text.length)),
      end: Math.max(0, Math.min(range.end, text.length)),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);

  const merged: MatchRange[] = [];
  for (const range of normalized) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }

  if (merged.length === 0) {
    return [{ text, highlighted: false }];
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) {
      segments.push({ text: text.slice(cursor, range.start), highlighted: false });
    }
    segments.push({ text: text.slice(range.start, range.end), highlighted: true });
    cursor = range.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlighted: false });
  }

  return segments;
}
