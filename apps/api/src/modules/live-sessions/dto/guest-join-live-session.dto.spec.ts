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
  it.each(['', '   ', 123, 'x'.repeat(81)])(
    'rejects invalid preview name edits: %j',
    (displayNameOverride) => {
      expect(() =>
        parseGuestJoinLiveSessionDto({
          displayName: 'Alice',
          passcode: 'demo',
          displayNameOverride,
        }),
      ).toThrow('Display name must');
    },
  );
});

it('accepts multiple students while rejecting ambiguous or malformed selections', () => {
  const ids = [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
  ];
  expect(
    parseGuestJoinLiveSessionDto({
      displayName: 'Student One & Student Two',
      passcode: '',
      studentProfileIds: ids,
    }),
  ).toMatchObject({ studentProfileIds: ids });
  for (const studentProfileIds of [
    [],
    [ids[0], ids[0]],
    ['invalid'],
    ids[0],
    Array(11).fill(ids[0]),
  ])
    expect(() =>
      parseGuestJoinLiveSessionDto({
        displayName: 'Students',
        passcode: '',
        studentProfileIds,
      }),
    ).toThrow();
  expect(() =>
    parseGuestJoinLiveSessionDto({
      displayName: 'Students',
      passcode: '',
      studentProfileId: ids[0],
      studentProfileIds: ids,
    }),
  ).toThrow();
});
