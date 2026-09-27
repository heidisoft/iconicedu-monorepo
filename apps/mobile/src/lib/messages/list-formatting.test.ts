import {
  applyListPrefixToSelection,
  messageTextHasListLines,
  parseMessageLines,
} from '@/lib/messages/list-formatting';

describe('parseMessageLines', () => {
  it('parses plain lines with no list marker', () => {
    expect(parseMessageLines('hello world')).toEqual([
      { kind: 'plain', content: 'hello world' },
    ]);
  });

  it('parses a bullet line', () => {
    expect(parseMessageLines('- milk')).toEqual([{ kind: 'bullet', content: 'milk' }]);
  });

  it('parses a numbered line and keeps the typed number', () => {
    expect(parseMessageLines('2. second step')).toEqual([
      { kind: 'numbered', content: 'second step', number: '2' },
    ]);
  });

  it('parses a mix of plain and list lines across a multi-line message', () => {
    expect(parseMessageLines('intro\n- one\n- two\noutro')).toEqual([
      { kind: 'plain', content: 'intro' },
      { kind: 'bullet', content: 'one' },
      { kind: 'bullet', content: 'two' },
      { kind: 'plain', content: 'outro' },
    ]);
  });
});

describe('messageTextHasListLines', () => {
  it('is false for plain text', () => {
    expect(messageTextHasListLines('just some text')).toBe(false);
  });

  it('is true when any line is a bullet or numbered line', () => {
    expect(messageTextHasListLines('notes\n- a bullet')).toBe(true);
    expect(messageTextHasListLines('1. first')).toBe(true);
  });
});

describe('applyListPrefixToSelection', () => {
  it('prefixes a single line with a bullet marker', () => {
    const result = applyListPrefixToSelection('milk', 0, 4, 'bullet');
    expect(result.text).toBe('- milk');
    expect(result.cursor).toBe(result.text.length);
  });

  it('prefixes multiple selected lines with incrementing numbers', () => {
    const text = 'first\nsecond\nthird';
    const result = applyListPrefixToSelection(text, 0, text.length, 'numbered');
    expect(result.text).toBe('1. first\n2. second\n3. third');
  });

  it('only prefixes the lines touched by the selection, leaving others untouched', () => {
    const text = 'keep me\nsecond\nthird\nkeep me too';
    // Selection sits entirely inside "second\nthird"
    const start = text.indexOf('second');
    const end = text.indexOf('third') + 'third'.length;
    const result = applyListPrefixToSelection(text, start, end, 'bullet');
    expect(result.text).toBe('keep me\n- second\n- third\nkeep me too');
  });

  it('starts numbering fresh at 1 for each new selection', () => {
    const text = 'a\nb';
    const result = applyListPrefixToSelection(text, 0, text.length, 'numbered');
    expect(result.text).toBe('1. a\n2. b');
  });

  it('handles an empty draft by inserting a ready-to-type marker', () => {
    const result = applyListPrefixToSelection('', 0, 0, 'bullet');
    expect(result.text).toBe('- ');
    expect(result.cursor).toBe(2);
  });
});
