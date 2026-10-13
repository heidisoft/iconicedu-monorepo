import { describe, expect, it } from 'vitest';

import {
  collapseNetworkLevel,
  createFloatingReaction,
  getReactionOrigin,
  parseParticipantCommand,
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

describe('reaction origins', () => {
  it('starts at the sender tile center relative to the overlay', () => {
    const origin = getReactionOrigin(
      { left: 500, top: 200, width: 240, height: 160 },
      { left: 100, top: 50 },
    );
    expect(origin).toEqual({ x: 520, y: 230 });
    expect(createFloatingReaction('🎉', origin).origin).toEqual(origin);
  });
  it('uses the smaller filmstrip tile center during presentation', () => {
    expect(
      getReactionOrigin(
        { left: 24, top: 600, width: 120, height: 80 },
        { left: 24, top: 100 },
      ),
    ).toEqual({ x: 60, y: 540 });
  });
});

describe('participant command messages', () => {
  it('normalizes Zoom string sender IDs for remote hand and reaction state', () => {
    expect(parseParticipantCommand('42', '{"type":"raise-hand","raised":true}')).toEqual({
      userId: 42,
      payload: { type: 'raise-hand', raised: true },
    });
    expect(parseParticipantCommand('42', '{"type":"raise-hand","raised":false}')).toEqual(
      { userId: 42, payload: { type: 'raise-hand', raised: false } },
    );
    expect(parseParticipantCommand('42', '{"type":"reaction","emoji":"🎉"}')).toEqual({
      userId: 42,
      payload: { type: 'reaction', emoji: '🎉' },
    });
    expect(
      parseParticipantCommand('42', '{"type":"raise-hand-state-request"}')?.userId,
    ).toBe(42);
  });
  it('ignores invalid sender IDs and malformed messages', () => {
    for (const id of ['', 'invalid', '0', '-1', '1.5'])
      expect(
        parseParticipantCommand(id, '{"type":"raise-hand","raised":true}'),
      ).toBeNull();
    for (const message of [
      'null',
      '{',
      '{"type":"raise-hand","raised":"false"}',
      '{"type":"reaction","emoji":42}',
    ])
      expect(parseParticipantCommand('42', message)).toBeNull();
  });
});
