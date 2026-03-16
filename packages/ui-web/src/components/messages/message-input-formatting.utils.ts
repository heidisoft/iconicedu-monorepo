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
