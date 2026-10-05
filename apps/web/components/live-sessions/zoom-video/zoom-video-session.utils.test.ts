import { describe, expect, it } from 'vitest';

import {
  annotationColorToHex,
  collapseNetworkLevel,
  formatElapsed,
  formatRelativeTime,
  getNetworkLevel,
  shouldUsePresentationLayout,
  worseNetworkLevel,
} from './zoom-video-session.utils';

describe('zoom video session utilities', () => {
  it('formats elapsed call time', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(125)).toBe('02:05');
  });

  it('formats chat timestamps relative to the current time', () => {
    const now = Date.UTC(2026, 9, 4, 12, 0, 0);
    expect(formatRelativeTime(now - 20_000, now)).toBe('Now');
    expect(formatRelativeTime(now - 8 * 60_000, now)).toBe('8 min ago');
    expect(formatRelativeTime(now - 2 * 60 * 60_000, now)).toBe('2 hr ago');
  });

  it('collapses and combines Zoom network levels', () => {
    expect(collapseNetworkLevel(1)).toBe('bad');
    expect(collapseNetworkLevel(2)).toBe('normal');
    expect(collapseNetworkLevel(5)).toBe('good');
    expect(worseNetworkLevel('good', 'bad')).toBe('bad');
    expect(getNetworkLevel({ 7: { uplink: 'good', downlink: 'normal' } }, 7)).toBe(
      'normal',
    );
  });

  it('converts the SDK annotation color format to CSS hex', () => {
    expect(annotationColorToHex(0xff3b82f6)).toBe('#3b82f6');
  });

  it('shows the presentation filmstrip before Zoom syncs the local share user', () => {
    expect(
      shouldUsePresentationLayout({
        hasActiveShareUser: false,
        isShowingLocalShare: true,
        isWhiteboardActive: false,
      }),
    ).toBe(true);
  });
});
