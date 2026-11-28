import { ForbiddenException } from '@nestjs/common';
import {
  enforceMessageAudiencePolicy,
  isMessageAudienceReviewer,
  loadMessageAudienceRoles,
} from './message-audience-policy';

type Row = Record<string, unknown>;

/**
 * Minimal in-memory stand-in for the Supabase query builder: supports the
 * eq/in/is filters the policy uses and resolves on `.returns()`.
 */
function fakeSupabase(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const filters: Array<(row: Row) => boolean> = [];
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters.push((row) => row[column] === value);
          return chain;
        },
        in: (column: string, values: unknown[]) => {
          filters.push((row) => values.includes(row[column]));
          return chain;
        },
        is: (column: string, value: unknown) => {
          filters.push((row) => (row[column] ?? null) === value);
          return chain;
        },
        returns: async () => ({
          data: (tables[table] ?? []).filter((row) => filters.every((f) => f(row))),
          error: null,
        }),
      };
      return chain;
    },
  } as never;
}

const ORG = 'org-1';
const CHANNEL = 'channel-1';

function profile(id: string, kind: string, accountId = `acct-${id}`) {
  return { id, org_id: ORG, account_id: accountId, kind, deleted_at: null };
}

/**
 * Channel members: staff, owner (kind educator but owner role), admin (primary
 * role), tutor, parentA (guardian of studentA), parentB, studentA, studentB
 * (no guardian in channel), studentC (guardian outside the channel).
 */
function classroom(overrides: Partial<Record<string, Row[]>> = {}) {
  return fakeSupabase({
    profiles: [
      profile('staff', 'staff'),
      profile('owner', 'educator'),
      profile('admin', 'guardian'),
      profile('tutor', 'educator'),
      profile('tutor2', 'educator'),
      profile('parentA', 'guardian'),
      profile('parentB', 'guardian'),
      profile('studentA', 'child'),
      profile('studentB', 'child'),
      profile('studentC', 'child'),
      profile('parentC', 'guardian'),
      profile('system', 'system'),
    ],
    user_roles: [
      { org_id: ORG, account_id: 'acct-owner', role_key: 'owner', deleted_at: null },
    ],
    accounts: [
      { id: 'acct-admin', org_id: ORG, primary_role: 'admin', deleted_at: null },
    ],
    family_links: [
      {
        org_id: ORG,
        guardian_account_id: 'acct-parentA',
        child_account_id: 'acct-studentA',
        deleted_at: null,
      },
      {
        org_id: ORG,
        guardian_account_id: 'acct-parentC',
        child_account_id: 'acct-studentC',
        deleted_at: null,
      },
    ],
    channel_members: [
      'staff',
      'owner',
      'admin',
      'tutor',
      'tutor2',
      'parentA',
      'parentB',
      'studentA',
      'studentB',
      'studentC',
    ].map((profile_id) => ({
      org_id: ORG,
      channel_id: CHANNEL,
      profile_id,
      deleted_at: null,
    })),
    ...overrides,
  });
}

function send(sender: string, recipients: string[], supabase = classroom()) {
  return enforceMessageAudiencePolicy({
    serviceSupabase: supabase,
    orgId: ORG,
    channelId: CHANNEL,
    senderProfileId: sender,
    requestedProfileIds: recipients,
  });
}

describe('loadMessageAudienceRoles', () => {
  it('treats staff profiles, owner role grants, and admin primary roles as staff', async () => {
    const roles = await loadMessageAudienceRoles(classroom(), ORG, [
      'staff',
      'owner',
      'admin',
      'tutor',
      'parentA',
      'studentA',
      'system',
    ]);
    expect(Object.fromEntries([...roles].map(([id, value]) => [id, value.role]))).toEqual(
      {
        staff: 'staff',
        owner: 'staff',
        admin: 'staff',
        tutor: 'tutor',
        parentA: 'parent',
        studentA: 'student',
        system: 'other',
      },
    );
  });

  it('ignores deleted and cross-organization profiles', async () => {
    const supabase = fakeSupabase({
      profiles: [
        { ...profile('gone', 'staff'), deleted_at: '2026-01-01' },
        { ...profile('elsewhere', 'staff'), org_id: 'org-2' },
      ],
    });
    expect(
      (await loadMessageAudienceRoles(supabase, ORG, ['gone', 'elsewhere'])).size,
    ).toBe(0);
  });
});

describe('enforceMessageAudiencePolicy', () => {
  describe.each(['staff', 'owner', 'admin'])('%s sender', (sender) => {
    it('can message anyone privately', async () => {
      await expect(send(sender, ['tutor', 'parentB'])).resolves.toEqual([
        sender,
        'tutor',
        'parentB',
      ]);
    });

    it('adds a student’s guardian automatically', async () => {
      await expect(send(sender, ['studentA'])).resolves.toEqual([
        sender,
        'studentA',
        'parentA',
      ]);
    });

    it('may reach a student whose guardian is not in the channel', async () => {
      await expect(send(sender, ['studentB'])).resolves.toEqual([sender, 'studentB']);
    });
  });

  describe('tutor sender', () => {
    it('can message staff, parents, and other tutors', async () => {
      await expect(send('tutor', ['staff', 'parentB', 'tutor2'])).resolves.toEqual([
        'tutor',
        'staff',
        'parentB',
        'tutor2',
      ]);
    });

    it('reaches a student only together with their guardian', async () => {
      await expect(send('tutor', ['studentA'])).resolves.toEqual([
        'tutor',
        'studentA',
        'parentA',
      ]);
    });

    it('does not duplicate a guardian the tutor already selected', async () => {
      await expect(send('tutor', ['parentA', 'studentA'])).resolves.toEqual([
        'tutor',
        'parentA',
        'studentA',
      ]);
    });

    it.each(['studentB', 'studentC'])(
      'cannot reach %s without a guardian in the channel',
      async (student) => {
        await expect(send('tutor', [student])).rejects.toThrow(
          'Students can only be messaged privately together with a parent in this channel',
        );
      },
    );

    it('rejects the whole message when any selected student is unaccompanied', async () => {
      await expect(send('tutor', ['studentA', 'studentB'])).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('parent sender', () => {
    it('can message staff and tutors', async () => {
      await expect(send('parentA', ['staff', 'tutor'])).resolves.toEqual([
        'parentA',
        'staff',
        'tutor',
      ]);
    });

    it.each([
      ['parentB', 'parents'],
      ['studentA', 'students'],
      ['studentB', 'students'],
    ])('cannot message %s privately', async (recipient, label) => {
      await expect(send('parentA', [recipient])).rejects.toThrow(
        `You cannot send private messages to ${label}`,
      );
    });

    it('cannot slip a blocked recipient in alongside allowed ones', async () => {
      await expect(send('parentA', ['tutor', 'parentB'])).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('student sender', () => {
    it.each([['staff'], ['tutor'], ['parentA'], ['studentB']])(
      'cannot start a private message to %s',
      async (recipient) => {
        await expect(send('studentA', [recipient])).rejects.toThrow(
          'Students can only send messages to everyone in the channel',
        );
      },
    );
  });

  it('rejects senders without a resolvable role', async () => {
    await expect(send('system', ['tutor'])).rejects.toThrow(
      'You cannot send private messages in this channel',
    );
    await expect(send('unknown-profile', ['tutor'])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('only staff can address members without a resolvable role', async () => {
    await expect(send('tutor', ['unknown-profile'])).rejects.toThrow('this member');
    await expect(send('staff', ['unknown-profile'])).resolves.toEqual([
      'staff',
      'unknown-profile',
    ]);
  });

  it('ignores deleted family links', async () => {
    const supabase = classroom({
      family_links: [
        {
          org_id: ORG,
          guardian_account_id: 'acct-parentA',
          child_account_id: 'acct-studentA',
          deleted_at: '2026-01-01',
        },
      ],
    });
    await expect(send('tutor', ['studentA'], supabase)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('isMessageAudienceReviewer', () => {
  it.each([
    ['staff', true],
    ['owner', true],
    ['admin', true],
    ['tutor', false],
    ['parentA', false],
    ['studentA', false],
  ])('%s -> %s', async (profileId, expected) => {
    await expect(
      isMessageAudienceReviewer({ serviceSupabase: classroom(), orgId: ORG, profileId }),
    ).resolves.toBe(expected);
  });
});
