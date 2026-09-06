import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('FeedbackRequestMessage', () => {
  const filename = fileURLToPath(import.meta.url);
  const source = readFileSync(
    resolve(dirname(filename), 'feedback-request-message.tsx'),
    'utf8',
  );

  it('submits feedback through the session completion API', () => {
    expect(source).toContain(
      '`/api/session-completions/${feedback.sessionCompletionId}/rate`',
    );
    expect(source).toContain('sessionCompletionId');
  });

  it('supports immediate five-star and comment flow for lower ratings', () => {
    expect(source).toContain('if (value === 5)');
    expect(source).toContain('setShowComment(true);');
    expect(source).toContain('placeholder="Tell us what could be better..."');
  });
});
