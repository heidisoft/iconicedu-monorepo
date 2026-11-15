export type ApplyFormatResult = {
  nextValue: string;
  selectionStart: number;
  selectionEnd: number;
};

export function applyInlineFormat(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  wrapper: string,
): ApplyFormatResult {
  const safeStart = Math.max(0, Math.min(selectionStart, value.length));
  const safeEnd = Math.max(safeStart, Math.min(selectionEnd, value.length));
  const selectedText = value.slice(safeStart, safeEnd);
  const nextValue =
    value.slice(0, safeStart) + wrapper + selectedText + wrapper + value.slice(safeEnd);

  if (safeStart === safeEnd) {
    const caret = safeStart + wrapper.length;
    return {
      nextValue,
      selectionStart: caret,
      selectionEnd: caret,
    };
  }

  return {
    nextValue,
    selectionStart: safeStart + wrapper.length,
    selectionEnd: safeEnd + wrapper.length,
  };
}

export type ListFormatKind = 'bullet' | 'numbered';

function buildListLinePrefix(kind: ListFormatKind, indexWithinList: number): string {
  return kind === 'bullet' ? '- ' : `${indexWithinList + 1}. `;
}

/**
 * Prefixes each line covered by the selection with a bullet ("- ") or an incrementing
 * numbered-list marker ("1. ", "2. ", ...). Unlike `applyInlineFormat`, this is
 * line-prefixing rather than delimiter-wrapping: it always expands the affected range to
 * whole lines first, so a partial-line selection still formats the entire line(s) it touches.
 */
export function applyListFormat(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  kind: ListFormatKind,
): ApplyFormatResult {
  const safeStart = Math.max(0, Math.min(selectionStart, value.length));
  const safeEnd = Math.max(safeStart, Math.min(selectionEnd, value.length));

  const lineStart = value.lastIndexOf('\n', safeStart - 1) + 1;
  const nextNewlineIndex = value.indexOf('\n', safeEnd);
  const lineEnd = nextNewlineIndex === -1 ? value.length : nextNewlineIndex;

  const affectedText = value.slice(lineStart, lineEnd);
  const lines = affectedText.split('\n');
  const formattedLines = lines.map(
    (line, index) => `${buildListLinePrefix(kind, index)}${line}`,
  );
  const formattedText = formattedLines.join('\n');

  const nextValue = value.slice(0, lineStart) + formattedText + value.slice(lineEnd);
  const caret = lineStart + formattedText.length;

  return {
    nextValue,
    selectionStart: caret,
    selectionEnd: caret,
  };
}
