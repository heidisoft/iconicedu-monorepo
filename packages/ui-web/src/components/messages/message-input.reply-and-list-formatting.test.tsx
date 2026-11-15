import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// MessageInput pulls in MediaRecorder/getUserMedia and other browser APIs that are
// impractical to fully mock in jsdom, so — consistent with
// message-input.create-button.test.tsx — flag-gating for its new toolbar/banner affordances
// is verified via source inspection rather than a full render. The underlying logic
// (applyListFormat, reply-target plumbing) is covered by dedicated unit/integration tests.
describe('MessageInput reply reference and list-formatting gating', () => {
  const filename = fileURLToPath(import.meta.url);
  const source = readFileSync(resolve(dirname(filename), 'message-input.tsx'), 'utf8');

  it('gates the list-formatting toolbar buttons behind enableMessageListFormatting', () => {
    expect(source).toContain('enableMessageListFormatting ? (');
    expect(source).toContain("applyListFormatAtSelection('bullet')");
    expect(source).toContain("applyListFormatAtSelection('numbered')");
  });

  it('gates the reply-target banner behind enableMessageReplyReference and a present replyTarget', () => {
    expect(source).toContain('enableMessageReplyReference && replyTarget ? (');
    expect(source).toContain('Replying to {replyTarget.senderName}');
    expect(source).toContain('aria-label="Cancel reply"');
  });

  it('defaults both new flags to off', () => {
    expect(source).toContain('enableMessageReplyReference = false,');
    expect(source).toContain('enableMessageListFormatting = false,');
  });
});
