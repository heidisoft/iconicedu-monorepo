import { resolveSessionTabJoinState } from './space-sessions-tab';

const EARLIER_ID = 'schedule-1__2026-04-03T10:00:00.000Z';
const LATER_ID = 'schedule-1__2026-04-10T10:00:00.000Z';

function buildSession(overrides?: {
  id?: string;
  disabled?: boolean;
  isPast?: boolean;
  meetingLink?: string | null;
  channelId?: string | null;
}) {
  return {
    id: overrides?.id ?? LATER_ID,
    disabled: overrides?.disabled ?? false,
    isPast: overrides?.isPast ?? false,
    meetingLink: overrides?.meetingLink ?? null,
    channelId: overrides?.channelId === undefined ? 'channel-1' : overrides.channelId,
  };
}

describe('resolveSessionTabJoinState', () => {
  describe('with enable-any-visible-class-session-join off', () => {
    it('enables Join only on the single selected occurrence', () => {
      expect(
        resolveSessionTabJoinState({
          session: buildSession(),
          isUpcomingTab: true,
          activeJoinSessionId: EARLIER_ID,
          anyVisibleJoinEnabled: false,
        }),
      ).toEqual({ joinEnabled: false, showJoinButton: true });
    });
  });

  describe('with enable-any-visible-class-session-join on', () => {
    it('makes a later upcoming occurrence independently joinable', () => {
      expect(
        resolveSessionTabJoinState({
          session: buildSession(),
          isUpcomingTab: true,
          activeJoinSessionId: EARLIER_ID,
          anyVisibleJoinEnabled: true,
        }),
      ).toEqual({ joinEnabled: true, showJoinButton: true });
    });

    it('omits Join for a disabled occurrence rather than showing a dead control', () => {
      expect(
        resolveSessionTabJoinState({
          session: buildSession({ disabled: true }),
          isUpcomingTab: true,
          activeJoinSessionId: null,
          anyVisibleJoinEnabled: true,
        }),
      ).toEqual({ joinEnabled: false, showJoinButton: false });
    });

    it('omits Join for past occurrences', () => {
      expect(
        resolveSessionTabJoinState({
          session: buildSession({ isPast: true }),
          isUpcomingTab: true,
          activeJoinSessionId: null,
          anyVisibleJoinEnabled: true,
        }),
      ).toEqual({ joinEnabled: false, showJoinButton: false });
    });

    it('omits Join on the past sub-tab', () => {
      expect(
        resolveSessionTabJoinState({
          session: buildSession(),
          isUpcomingTab: false,
          activeJoinSessionId: null,
          anyVisibleJoinEnabled: true,
        }),
      ).toEqual({ joinEnabled: false, showJoinButton: false });
    });

    it('omits Join when there is no channel or meeting link to join', () => {
      expect(
        resolveSessionTabJoinState({
          session: buildSession({ channelId: null }),
          isUpcomingTab: true,
          activeJoinSessionId: null,
          anyVisibleJoinEnabled: true,
        }),
      ).toEqual({ joinEnabled: false, showJoinButton: false });
    });

    it('never renders a visible-but-disabled Join', () => {
      const cases = [true, false].flatMap((disabled) =>
        [true, false].map((isPast) =>
          resolveSessionTabJoinState({
            session: buildSession({ disabled, isPast }),
            isUpcomingTab: true,
            activeJoinSessionId: null,
            anyVisibleJoinEnabled: true,
          }),
        ),
      );

      cases.forEach((state) => expect(state.showJoinButton).toBe(state.joinEnabled));
    });
  });
});
