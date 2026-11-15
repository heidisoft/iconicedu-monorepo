/**
 * Mobile port of packages/ui-web/src/components/messages/message-input-formatting.utils.ts.
 * Web tracks selection via HTMLTextAreaElement.selectionStart/selectionEnd; RN's
 * TextInput exposes the same concept via the `selection` prop / onSelectionChange
 * event, shaped as `{ start: number; end: number }`. The wrapping behavior is
 * identical: wrap the selected range in `wrapper` on both sides, or (when there is
 * no selection) insert both markers at the caret and place the cursor between them.
 */

export type TextSelection = { start: number; end: number };

export type ApplyFormatResult = {
  nextValue: string;
  selection: TextSelection;
};

export function applyInlineFormat(
  value: string,
  selection: TextSelection,
  wrapper: string,
): ApplyFormatResult {
  const safeStart = Math.max(0, Math.min(selection.start, value.length));
  const safeEnd = Math.max(safeStart, Math.min(selection.end, value.length));
  const selectedText = value.slice(safeStart, safeEnd);
  const nextValue =
    value.slice(0, safeStart) + wrapper + selectedText + wrapper + value.slice(safeEnd);

  if (safeStart === safeEnd) {
    const caret = safeStart + wrapper.length;
    return { nextValue, selection: { start: caret, end: caret } };
  }

  return {
    nextValue,
    selection: {
      start: safeStart + wrapper.length,
      end: safeEnd + wrapper.length,
    },
  };
}
