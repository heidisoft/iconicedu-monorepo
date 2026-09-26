/**
 * Shared helpers for the mobile "list formatting" P1 capability: authoring
 * bullet/numbered lists in the composer (message-input.tsx) and rendering
 * them back on sent messages (message-item.tsx / feed-message-list.tsx).
 *
 * Lists are plain-text markdown-ish conventions — "- " for a bullet line and
 * "1. " (etc.) for a numbered line — so no new wire format is needed; this
 * module is the single place that parses/produces that convention.
 */

export type ListLineKind = 'plain' | 'bullet' | 'numbered';

export type ParsedMessageLine = {
  kind: ListLineKind;
  /** The line's text with any list marker stripped. */
  content: string;
  /** Only set for numbered lines — the literal number the author typed. */
  number?: string;
};

const BULLET_LINE_RE = /^- (.*)$/;
const NUMBERED_LINE_RE = /^(\d+)\. (.*)$/;

export function parseMessageLines(text: string): ParsedMessageLine[] {
  return text.split('\n').map((line) => {
    const bulletMatch = BULLET_LINE_RE.exec(line);
    if (bulletMatch) {
      return { kind: 'bullet', content: bulletMatch[1] ?? '' };
    }
    const numberedMatch = NUMBERED_LINE_RE.exec(line);
    if (numberedMatch) {
      return {
        kind: 'numbered',
        content: numberedMatch[2] ?? '',
        number: numberedMatch[1],
      };
    }
    return { kind: 'plain', content: line };
  });
}

/** True when at least one line in the text is a bullet or numbered list line. */
export function messageTextHasListLines(text: string): boolean {
  return parseMessageLines(text).some((line) => line.kind !== 'plain');
}

/**
 * Prefixes every line touched by the given selection with a bullet ("- ") or
 * an incrementing number ("1. ", "2. ", ...), starting the numbering fresh
 * for this selection. Returns the updated text and the cursor position right
 * after the newly-prefixed block.
 */
export function applyListPrefixToSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  kind: Exclude<ListLineKind, 'plain'>,
): { text: string; cursor: number } {
  const start = Math.max(0, Math.min(selectionStart, selectionEnd));
  const end = Math.max(selectionStart, selectionEnd);

  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const nextNewline = text.indexOf('\n', end);
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;

  const before = text.slice(0, lineStart);
  const selected = text.slice(lineStart, lineEnd);
  const after = text.slice(lineEnd);

  let counter = 1;
  const prefixed = selected
    .split('\n')
    .map((line) => (kind === 'bullet' ? `- ${line}` : `${counter++}. ${line}`))
    .join('\n');

  return {
    text: `${before}${prefixed}${after}`,
    cursor: before.length + prefixed.length,
  };
}
