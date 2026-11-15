import type { MessageMentionVM } from '@iconicedu/shared-types';

const BULLET_LINE = /^- (.*)$/;
const NUMBERED_LINE = /^\d+\. (.*)$/;

export type MessageListBlockItem = { text: string; start: number; end: number };

export type MessageContentBlock =
  | { kind: 'text'; text: string; start: number; end: number }
  | { kind: 'bullet-list' | 'numbered-list'; items: MessageListBlockItem[] };

function getLineOffsets(text: string): Array<{ text: string; start: number }> {
  const result: Array<{ text: string; start: number }> = [];
  let start = 0;
  for (const line of text.split('\n')) {
    result.push({ text: line, start });
    start += line.length + 1;
  }
  return result;
}

/**
 * Splits message text into a sequence of blocks: runs of consecutive "- " (bullet) or
 * "1. "/"2. " (numbered) prefixed lines become list blocks; everything else is grouped into
 * text blocks that pass through unchanged. Each block/item keeps its absolute character
 * offset range within the original text, so mentions (which carry absolute offsets) can be
 * sliced and remapped per block via `sliceMentionsForRange`.
 *
 * When no list-prefixed lines are present, this returns a single text block spanning the
 * whole input — equivalent to not splitting at all.
 */
export function splitTextIntoListBlocks(text: string): MessageContentBlock[] {
  const lineOffsets = getLineOffsets(text);
  const blocks: MessageContentBlock[] = [];
  let i = 0;

  while (i < lineOffsets.length) {
    const bulletMatch = BULLET_LINE.exec(lineOffsets[i].text);
    const numberedMatch = !bulletMatch ? NUMBERED_LINE.exec(lineOffsets[i].text) : null;

    if (bulletMatch || numberedMatch) {
      const kind: 'bullet-list' | 'numbered-list' = bulletMatch
        ? 'bullet-list'
        : 'numbered-list';
      const regex = bulletMatch ? BULLET_LINE : NUMBERED_LINE;
      const items: MessageListBlockItem[] = [];
      while (i < lineOffsets.length) {
        const match = regex.exec(lineOffsets[i].text);
        if (!match) break;
        const prefixLength = lineOffsets[i].text.length - match[1].length;
        items.push({
          text: match[1],
          start: lineOffsets[i].start + prefixLength,
          end: lineOffsets[i].start + lineOffsets[i].text.length,
        });
        i += 1;
      }
      blocks.push({ kind, items });
      continue;
    }

    const startLineIndex = i;
    while (
      i < lineOffsets.length &&
      !BULLET_LINE.test(lineOffsets[i].text) &&
      !NUMBERED_LINE.test(lineOffsets[i].text)
    ) {
      i += 1;
    }
    const textLines = lineOffsets.slice(startLineIndex, i);
    const start = textLines[0]?.start ?? 0;
    const lastLine = textLines[textLines.length - 1];
    const end = lastLine ? lastLine.start + lastLine.text.length : start;
    blocks.push({
      kind: 'text',
      text: textLines.map((line) => line.text).join('\n'),
      start,
      end,
    });
  }

  return blocks;
}

export function hasListBlocks(blocks: MessageContentBlock[]): boolean {
  return blocks.some((block) => block.kind !== 'text');
}

/** Filters mentions to those fully contained in [rangeStart, rangeEnd) and remaps their offsets to be relative to that range. */
export function sliceMentionsForRange(
  mentions: MessageMentionVM[] | undefined,
  rangeStart: number,
  rangeEnd: number,
): MessageMentionVM[] {
  if (!mentions?.length) return [];
  return mentions
    .filter((mention) => mention.start >= rangeStart && mention.end <= rangeEnd)
    .map((mention) => ({
      ...mention,
      start: mention.start - rangeStart,
      end: mention.end - rangeStart,
    }));
}
