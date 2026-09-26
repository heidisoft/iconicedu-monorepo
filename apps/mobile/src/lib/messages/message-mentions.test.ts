import {
  disambiguateMentionCandidateLabels,
  extractMentionsFromMessageText,
  getMentionCandidates,
  getMentionState,
  insertMention,
  rankMentionCandidates,
  type MentionCandidate,
} from '@/lib/messages/message-mentions';
import type { ChannelMemberProfileItem } from '@/lib/api/channel/queries';

function makeMember(
  overrides: Partial<ChannelMemberProfileItem> = {},
): ChannelMemberProfileItem {
  return {
    id: 'member-1',
    name: 'Alex Chen',
    avatarSeed: null,
    themeKey: null,
    role: 'tutor',
    accountId: null,
    bio: null,
    email: null,
    timezone: null,
    ...overrides,
  };
}

describe('getMentionCandidates', () => {
  it('excludes the current profile and blank display names', () => {
    const members = [
      makeMember({ id: 'me', name: 'Me' }),
      makeMember({ id: 'other', name: 'Jordan Lee' }),
      makeMember({ id: 'blank', name: '   ' }),
    ];

    expect(getMentionCandidates(members, 'me')).toEqual([
      { id: 'other', displayName: 'Jordan Lee', role: 'tutor' },
    ]);
  });

  it('returns an empty list when members is not an array (e.g. an unresolved query)', () => {
    expect(getMentionCandidates(undefined, 'me')).toEqual([]);
    expect(getMentionCandidates(null, 'me')).toEqual([]);
    expect(
      getMentionCandidates(
        { lastReadMessageId: null } as unknown as ChannelMemberProfileItem[],
        'me',
      ),
    ).toEqual([]);
  });
});

describe('rankMentionCandidates', () => {
  const candidates: MentionCandidate[] = [
    { id: '1', displayName: 'Alexis Doe', role: null },
    { id: '2', displayName: 'Alex Chen', role: null },
    { id: '3', displayName: 'Blake Alex', role: null },
  ];

  it('ranks exact match, then prefix, then substring', () => {
    const ranked = rankMentionCandidates(candidates, 'Alex Chen');
    expect(ranked[0].id).toBe('2');
  });

  it('ranks a prefix match before a mid-string substring match', () => {
    const ranked = rankMentionCandidates(candidates, 'alex');
    expect(ranked.map((c) => c.id)).toEqual(['2', '1', '3']);
  });

  it('sorts alphabetically when the query is empty', () => {
    const ranked = rankMentionCandidates(candidates, '');
    expect(ranked.map((c) => c.id)).toEqual(['2', '1', '3']);
  });
});

describe('disambiguateMentionCandidateLabels', () => {
  it('appends role context only for duplicate display names', () => {
    const candidates: MentionCandidate[] = [
      { id: '1', displayName: 'Sam Lee', role: 'tutor' },
      { id: '2', displayName: 'Sam Lee', role: 'guardian' },
      { id: '3', displayName: 'Unique Name', role: 'tutor' },
    ];

    const labeled = disambiguateMentionCandidateLabels(candidates);
    expect(labeled.find((c) => c.id === '1')?.label).toBe('Sam Lee (tutor)');
    expect(labeled.find((c) => c.id === '2')?.label).toBe('Sam Lee (guardian)');
    expect(labeled.find((c) => c.id === '3')?.label).toBe('Unique Name');
  });
});

describe('getMentionState', () => {
  it('detects an in-progress @query right before the caret', () => {
    expect(getMentionState('Hello @al', 9)).toEqual({ query: 'al', start: 6, end: 9 });
  });

  it('returns null when the @ is mid-word', () => {
    expect(getMentionState('email@example', 13)).toBeNull();
  });

  it('returns null when there is no @ before the caret', () => {
    expect(getMentionState('Hello world', 11)).toBeNull();
  });

  it('returns null when the caret position is null', () => {
    expect(getMentionState('Hello @al', null)).toBeNull();
  });
});

describe('insertMention', () => {
  it('replaces the @query range with @DisplayName plus a trailing space', () => {
    const result = insertMention('Hello @al', { start: 6, end: 9 }, 'Alex Chen');
    expect(result.nextValue).toBe('Hello @Alex Chen ');
    expect(result.caret).toBe(17);
  });
});

describe('extractMentionsFromMessageText', () => {
  const candidates: MentionCandidate[] = [
    { id: 'profile-1', displayName: 'Alex Chen', role: 'tutor' },
    { id: 'profile-2', displayName: 'Alex', role: 'guardian' },
  ];

  it('matches the longest candidate name at a mention position', () => {
    const mentions = extractMentionsFromMessageText(
      'Hi @Alex Chen, see you then',
      candidates,
    );
    expect(mentions).toEqual([
      { profileId: 'profile-1', displayName: 'Alex Chen', start: 3, end: 13 },
    ]);
  });

  it('requires a word boundary before and after the mention', () => {
    expect(extractMentionsFromMessageText('email@Alex Chen.com', candidates)).toEqual([]);
    expect(
      extractMentionsFromMessageText('Hi @AlexChenAndOthers are here', candidates),
    ).toEqual([]);
  });

  it('produces a start/end that satisfies the server sanitizeMentions invariant', () => {
    const text = 'Hi @Alex, is @Alex Chen available?';
    const mentions = extractMentionsFromMessageText(text, candidates);
    for (const mention of mentions) {
      expect(text.slice(mention.start, mention.end)).toBe(`@${mention.displayName}`);
    }
    expect(mentions).toEqual([
      { profileId: 'profile-2', displayName: 'Alex', start: 3, end: 8 },
      { profileId: 'profile-1', displayName: 'Alex Chen', start: 13, end: 23 },
    ]);
  });

  it('returns no mentions for plain text', () => {
    expect(extractMentionsFromMessageText('No mentions here', candidates)).toEqual([]);
  });
});
