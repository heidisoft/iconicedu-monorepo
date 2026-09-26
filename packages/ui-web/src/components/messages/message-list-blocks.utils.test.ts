import { describe, expect, it } from 'vitest';

import {
  hasListBlocks,
  sliceMentionsForRange,
  splitTextIntoListBlocks,
} from './message-list-blocks.utils';

describe('splitTextIntoListBlocks', () => {
  it('returns a single text block for plain text with no list markers', () => {
    const text = 'Hello there\nHow are you?';
    const blocks = splitTextIntoListBlocks(text);

    expect(blocks).toEqual([{ kind: 'text', text, start: 0, end: text.length }]);
    expect(hasListBlocks(blocks)).toBe(false);
  });

  it('detects a run of consecutive bullet lines as a bullet-list block', () => {
    const text = 'Shopping list:\n- milk\n- eggs\n- bread';
    const blocks = splitTextIntoListBlocks(text);

    expect(hasListBlocks(blocks)).toBe(true);
    expect(blocks[0]).toMatchObject({ kind: 'text', text: 'Shopping list:' });
    expect(blocks[1]).toMatchObject({
      kind: 'bullet-list',
      items: [{ text: 'milk' }, { text: 'eggs' }, { text: 'bread' }],
    });
  });

  it('detects a run of consecutive numbered lines as a numbered-list block', () => {
    const text = '1. First\n2. Second\n3. Third';
    const blocks = splitTextIntoListBlocks(text);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      kind: 'numbered-list',
      items: [{ text: 'First' }, { text: 'Second' }, { text: 'Third' }],
    });
  });

  it('splits back to a text block once list-prefixed lines end', () => {
    const text = '- one\n- two\nDone!';
    const blocks = splitTextIntoListBlocks(text);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].kind).toBe('bullet-list');
    expect(blocks[1]).toMatchObject({ kind: 'text', text: 'Done!' });
  });

  it('keeps absolute character offsets for list items so mentions can be remapped', () => {
    const text = '- @Taylor please review\n- ok';
    const blocks = splitTextIntoListBlocks(text);
    const bulletBlock = blocks[0];
    if (bulletBlock.kind !== 'bullet-list') throw new Error('expected bullet-list');

    // "- " is 2 chars, so the first item's content starts at offset 2 and ends at the
    // length of the full first line ("- @Taylor please review" is 23 chars).
    expect(bulletBlock.items[0]).toMatchObject({
      text: '@Taylor please review',
      start: 2,
      end: 23,
    });
  });
});

describe('sliceMentionsForRange', () => {
  it('returns an empty array when there are no mentions', () => {
    expect(sliceMentionsForRange(undefined, 0, 10)).toEqual([]);
  });

  it('keeps only mentions fully inside the range and remaps their offsets', () => {
    const mentions = [
      { profileId: 'p1', displayName: 'Taylor', start: 2, end: 9 },
      { profileId: 'p2', displayName: 'Out of range', start: 20, end: 30 },
    ];

    const sliced = sliceMentionsForRange(mentions, 2, 24);

    expect(sliced).toEqual([
      { profileId: 'p1', displayName: 'Taylor', start: 0, end: 7 },
    ]);
  });
});
