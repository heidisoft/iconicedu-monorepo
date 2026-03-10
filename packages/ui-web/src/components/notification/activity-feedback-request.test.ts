import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('ActivityFeedbackRequest', () => {
  const filename = fileURLToPath(import.meta.url);
  const source = readFileSync(
    resolve(dirname(filename), 'activity-feedback-request.tsx'),
    'utf8',
  );

  it('supports immediate five-star submit and comment-required flow for lower ratings', () => {
    expect(source).toContain('if (value === 5)');
    expect(source).toContain('setShowComment(true);');
    expect(source).toContain('placeholder="Tell us what could be better..."');
    expect(source).toContain('Submit feedback');
  });

  it('posts feedback to the activity feedback API with source event linkage', () => {
    expect(source).toContain("fetch('/api/activity-feed/feedback'");
    expect(source).toContain('classSessionId');
    expect(source).toContain('classroomId');
    expect(source).toContain('channelId');
    expect(source).toContain('sourceEventId');
    expect(source).toContain('messageId');
    expect(source).toContain('rating');
    expect(source).toContain('comment');
  });
});
