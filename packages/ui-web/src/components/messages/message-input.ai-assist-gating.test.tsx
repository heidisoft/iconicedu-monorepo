import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('MessageInput AI-assist flag gating', () => {
  const filename = fileURLToPath(import.meta.url);
  const source = readFileSync(resolve(dirname(filename), 'message-input.tsx'), 'utf8');

  it('gates the refine trigger behind showAiRefine and the length threshold', () => {
    expect(source).toContain(
      'showAiRefine && content.trim().length >= AI_REFINE_MIN_CONTENT_LENGTH ? (',
    );
    expect(source).toContain('aria-label="Refine with AI"');
  });

  it('gates the suggested-replies trigger behind showAiSuggestedReplies', () => {
    expect(source).toContain('showAiSuggestedReplies ? (');
    expect(source).toContain('aria-label="Suggested replies"');
  });

  it('never lets a refined draft replace content without explicit user action', () => {
    // "Replace" is the only path that writes AI output into `content`; it must be wired
    // to an explicit button click, not any automatic/timer-driven effect.
    expect(source).toContain('onClick={handleAiRefineReplace}');
    expect(source).not.toMatch(/setTimeout\([^)]*handleAiRefineReplace/);
  });

  it('never auto-sends a suggested reply', () => {
    expect(source).toContain('handleSelectSuggestedReply');
    expect(source).not.toMatch(
      /handleSelectSuggestedReply[\s\S]{0,200}(handleSend|onSend)\(/,
    );
  });
});
