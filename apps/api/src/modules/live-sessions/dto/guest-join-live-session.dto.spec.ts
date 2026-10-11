import { parseGuestJoinLiveSessionDto } from './guest-join-live-session.dto';

describe('live session student selection request', () => {
  it('accepts an optional student UUID while preserving name and passcode normalization', () => {
    expect(
      parseGuestJoinLiveSessionDto({
        displayName: ' Alice ',
        passcode: ' demo ',
        studentProfileId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toEqual({
      displayName: 'Alice',
      passcode: 'demo',
      studentProfileId: '11111111-1111-4111-8111-111111111111',
    });
  });
  it.each([null, 123, {}, '', 'not-a-profile'])(
    'rejects a malformed student ID: %j',
    (studentProfileId) => {
      expect(() =>
        parseGuestJoinLiveSessionDto({
          displayName: 'Alice',
          passcode: 'demo',
          studentProfileId,
        }),
      ).toThrow('Invalid student profile');
    },
  );
});
