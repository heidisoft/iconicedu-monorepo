/**
 * Extracts a coarse set of "facts" (mentions, URLs, monetary amounts, and
 * date/time-shaped tokens) from a piece of text. This is a heuristic, not a
 * parser — it exists only to flag "the AI may have dropped something
 * important," not to guarantee correctness. False positives (flagging a
 * harmless rewrite) are an acceptable cost; false negatives (a real fact
 * silently dropped) are the failure mode this guards against.
 */
const MENTION_PATTERN = /@[A-Za-z][\w-]*(?:\s[A-Z][\w-]*)?/g;
const URL_PATTERN = /https?:\/\/\S+/gi;
const AMOUNT_PATTERN = /\$\s?\d+(?:,\d{3})*(?:\.\d{2})?/g;
const DATE_PATTERN =
  /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\b/gi;
const TIME_PATTERN = /\b\d{1,2}(?::\d{2})?\s?(?:am|pm|AM|PM)\b/g;

/** Strips trailing sentence punctuation a greedy URL match picks up (e.g. the comma in "...slip, the"). */
function trimTrailingPunctuation(token: string): string {
  return token.replace(/[.,;:!?)]+$/, '');
}

function extractTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const match of text.match(URL_PATTERN) ?? []) {
    tokens.push(trimTrailingPunctuation(match));
  }
  for (const pattern of [MENTION_PATTERN, AMOUNT_PATTERN, DATE_PATTERN, TIME_PATTERN]) {
    const matches = text.match(pattern);
    if (matches) tokens.push(...matches);
  }
  return tokens;
}

function normalize(token: string): string {
  return token.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function checkFactPreservation(
  original: string,
  revised: string,
): { preserved: boolean; missing: string[] } {
  const originalTokens = extractTokens(original);
  if (!originalTokens.length) {
    return { preserved: true, missing: [] };
  }

  const normalizedRevised = normalize(revised);
  const missing = Array.from(new Set(originalTokens)).filter(
    (token) => !normalizedRevised.includes(normalize(token)),
  );

  return { preserved: missing.length === 0, missing };
}
