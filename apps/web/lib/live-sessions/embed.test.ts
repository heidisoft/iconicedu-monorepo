import { describe, expect, it } from 'vitest';

import {
  canEmbedLiveSession,
  getEmbeddedLiveSessionFrameAllow,
  getEmbeddedLiveSessionTitle,
} from '@iconicedu/web/lib/live-sessions/embed';

describe('live-sessions/embed', () => {
  it('detects whether a live session can be embedded', () => {
    expect(canEmbedLiveSession('https://example.com')).toBe(true);
    expect(canEmbedLiveSession('')).toBe(false);
    expect(canEmbedLiveSession(null)).toBe(false);
  });

  it('returns provider-specific iframe permissions', () => {
    expect(getEmbeddedLiveSessionFrameAllow('daily')).toContain('display-capture');
    expect(getEmbeddedLiveSessionFrameAllow('custom')).not.toContain('display-capture');
  });

  it('returns a readable provider title', () => {
    expect(getEmbeddedLiveSessionTitle('daily')).toBe('Daily live session');
    expect(getEmbeddedLiveSessionTitle('custom')).toBe('Live session');
  });
});
