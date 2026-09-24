import { applyInlineFormat } from '@/lib/messages/message-input-formatting';

describe('applyInlineFormat', () => {
  it('wraps a selected range in the wrapper and shifts the selection past it', () => {
    const result = applyInlineFormat('Hello world', { start: 6, end: 11 }, '**');
    expect(result.nextValue).toBe('Hello **world**');
    expect(result.selection).toEqual({ start: 8, end: 13 });
  });

  it('wraps with single-asterisk italics', () => {
    const result = applyInlineFormat('Hello world', { start: 0, end: 5 }, '*');
    expect(result.nextValue).toBe('*Hello* world');
    expect(result.selection).toEqual({ start: 1, end: 6 });
  });

  it('inserts both markers at the caret and centers the cursor when nothing is selected', () => {
    const result = applyInlineFormat('Hello world', { start: 5, end: 5 }, '**');
    expect(result.nextValue).toBe('Hello**** world');
    expect(result.selection).toEqual({ start: 7, end: 7 });
  });

  it('clamps an out-of-range selection to the text bounds', () => {
    const result = applyInlineFormat('Hi', { start: -5, end: 999 }, '**');
    expect(result.nextValue).toBe('**Hi**');
    expect(result.selection).toEqual({ start: 2, end: 4 });
  });
});
