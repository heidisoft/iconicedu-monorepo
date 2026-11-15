import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearLiveSessionRecovery,
  readLiveSessionRecovery,
  rememberLiveSession,
} from '@iconicedu/web/lib/live-sessions/browser-session';

describe('live session browser recovery', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('restores an active session and its device preferences', () => {
    rememberLiveSession('session-1', { muted: true, videoOff: false });

    expect(readLiveSessionRecovery('session-1')).toMatchObject({
      muted: true,
      videoOff: false,
    });
  });

  it('removes expired recovery data', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    rememberLiveSession(
      'session-1',
      { muted: false, videoOff: false },
      {
        expiresAt: new Date(999).toISOString(),
      },
    );

    expect(readLiveSessionRecovery('session-1')).toBeNull();
  });

  it('clears recovery after an intentional leave', () => {
    rememberLiveSession('session-1', { muted: false, videoOff: false });
    clearLiveSessionRecovery('session-1');

    expect(readLiveSessionRecovery('session-1')).toBeNull();
  });
});
