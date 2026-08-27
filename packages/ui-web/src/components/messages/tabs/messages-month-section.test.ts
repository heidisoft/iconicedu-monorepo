import { describe, expect, it } from 'vitest';

import { resolveSessionJoinState } from './messages-month-section';

const BASE = {
  sessionId: 'schedule-1__2026-04-10T10:00:00.000Z',
  disabled: false,
  joinVisible: true,
  joinableSessionId: 'schedule-1__2026-04-03T10:00:00.000Z',
};

describe('resolveSessionJoinState', () => {
  describe('with enable-any-visible-class-session-join off', () => {
    it('enables Join only on the single selected occurrence', () => {
      expect(resolveSessionJoinState({ ...BASE, anyVisibleJoinEnabled: false })).toEqual({
        canJoin: false,
        showJoinButton: true,
      });
    });

    it('enables Join on the selected occurrence itself', () => {
      expect(
        resolveSessionJoinState({
          ...BASE,
          sessionId: BASE.joinableSessionId,
          anyVisibleJoinEnabled: false,
        }),
      ).toEqual({ canJoin: true, showJoinButton: true });
    });
  });

  describe('with enable-any-visible-class-session-join on', () => {
    it('makes a later upcoming occurrence independently joinable', () => {
      expect(resolveSessionJoinState({ ...BASE, anyVisibleJoinEnabled: true })).toEqual({
        canJoin: true,
        showJoinButton: true,
      });
    });

    it('omits Join entirely for a disabled occurrence rather than showing a dead one', () => {
      expect(
        resolveSessionJoinState({
          ...BASE,
          disabled: true,
          anyVisibleJoinEnabled: true,
        }),
      ).toEqual({ canJoin: false, showJoinButton: false });
    });

    it('omits Join when live sessions are not available on the channel', () => {
      expect(
        resolveSessionJoinState({
          ...BASE,
          joinVisible: false,
          anyVisibleJoinEnabled: true,
        }),
      ).toEqual({ canJoin: false, showJoinButton: false });
    });

    it('never produces a visible-but-disabled Join', () => {
      const cases = [true, false].flatMap((disabled) =>
        [true, false].map((joinVisible) =>
          resolveSessionJoinState({
            ...BASE,
            disabled,
            joinVisible,
            anyVisibleJoinEnabled: true,
          }),
        ),
      );

      cases.forEach((state) => expect(state.showJoinButton).toBe(state.canJoin));
    });
  });
});
