// ─── Search match-range highlighting (issue #264 P2) ───────────────────────
//
// `matchRanges` come pre-computed from the server (case-insensitive substring
// offsets into the message's plain text) — see `MessageSearchResult` in
// apps/mobile/src/lib/api/messages/queries.ts. We never recompute matching
// client-side; we only split the text into highlighted/plain segments here.

export type TextSegment = {
  text: string;
  matched: boolean;
};

/**
 * Splits `text` into an ordered list of segments using pre-computed
 * `matchRanges` (each `{ start, end }` is a half-open [start, end) offset
 * into `text`). Overlapping/out-of-order ranges are normalized; ranges that
 * fall outside the text bounds are clamped or dropped.
 */
export function splitTextByMatchRanges(
  text: string,
  matchRanges: Array<{ start: number; end: number }> | undefined | null,
): TextSegment[] {
  if (!text) return [];
  if (!matchRanges || matchRanges.length === 0) {
    return [{ text, matched: false }];
  }

  const normalized = matchRanges
    .map((r) => ({
      start: Math.max(0, Math.min(r.start, text.length)),
      end: Math.max(0, Math.min(r.end, text.length)),
    }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);

  if (normalized.length === 0) {
    return [{ text, matched: false }];
  }

  // Merge overlapping/adjacent ranges
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of normalized) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }

  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) {
      segments.push({ text: text.slice(cursor, range.start), matched: false });
    }
    segments.push({ text: text.slice(range.start, range.end), matched: true });
    cursor = range.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), matched: false });
  }

  return segments;
}

/** Extracts the plain text + mentions-stripped snippet from a search result's message, for display. */
export function getSearchResultText(message: {
  core: { type: string };
  content?: { text?: string };
}): string {
  if (message.core.type !== 'text') return '';
  return message.content?.text ?? '';
}
