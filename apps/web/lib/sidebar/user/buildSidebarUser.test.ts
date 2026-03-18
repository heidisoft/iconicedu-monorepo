import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AccountRow, ProfileRow } from '@iconicedu/shared-types';

import { __test__ } from '@iconicedu/web/lib/sidebar/user/buildSidebarUser';

describe('buildSidebarUser addable persona diagnostics', () => {
  afterEach(() => {
    delete process.env.DEBUG_POSTHOG_FLAGS;
    vi.restoreAllMocks();
  });

  it('builds addable personas and reasons from roles and existing profiles', () => {
    const evaluation = __test__.buildAddablePersonaEvaluation({
      userRoles: [{ roleKey: 'guardian' }] as Array<{ roleKey: string }>,
      primaryRole: 'owner' as AccountRow['primary_role'],
      profileRows: [{ kind: 'guardian' }, { kind: 'child' }] as Array<
        Pick<ProfileRow, 'kind'>
      >,
    });

    expect(evaluation.addablePersonas).toEqual([{ kind: 'staff', label: 'Staff' }]);
    expect(evaluation.reasons).toEqual({
      educator: 'missing-role',
      guardian: 'already-exists',
      child: 'missing-role',
      staff: 'addable',
    });
  });

  it('does not emit debug logs when debug flag is disabled', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    __test__.logPersonaAddableEvaluation({
      accountId: 'account-1',
      orgId: 'org-1',
      activeProfileId: 'profile-1',
      derivedKind: 'guardian',
      primaryRole: 'guardian' as AccountRow['primary_role'],
      evaluation: {
        addablePersonas: [{ kind: 'child', label: 'Student' }],
        roleKeys: new Set(['guardian', 'child']),
        existingKinds: new Set(['guardian']),
        reasons: {
          educator: 'missing-role',
          guardian: 'already-exists',
          child: 'addable',
          staff: 'missing-role',
        },
      },
    });

    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('emits evaluation and empty-reason logs when debug flag is enabled and none are addable', () => {
    process.env.DEBUG_POSTHOG_FLAGS = 'true';
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    __test__.logPersonaAddableEvaluation({
      accountId: 'account-1',
      orgId: 'org-1',
      activeProfileId: 'profile-1',
      derivedKind: 'guardian',
      primaryRole: 'guardian' as AccountRow['primary_role'],
      evaluation: {
        addablePersonas: [],
        roleKeys: new Set(['guardian']),
        existingKinds: new Set(['guardian']),
        reasons: {
          educator: 'missing-role',
          guardian: 'already-exists',
          child: 'missing-role',
          staff: 'missing-role',
        },
      },
    });

    expect(infoSpy).toHaveBeenNthCalledWith(
      1,
      '[persona-flags]',
      'sidebar-user-addable-evaluation',
      {
        accountId: 'account-1',
        orgId: 'org-1',
        activeProfileId: 'profile-1',
        derivedKind: 'guardian',
        primaryRole: 'guardian',
        userRoleKeys: ['guardian'],
        existingProfileKinds: ['guardian'],
        addablePersonas: [],
      },
    );
    expect(infoSpy).toHaveBeenNthCalledWith(
      2,
      '[persona-flags]',
      'sidebar-user-addable-empty',
      {
        accountId: 'account-1',
        orgId: 'org-1',
        activeProfileId: 'profile-1',
        derivedKind: 'guardian',
        primaryRole: 'guardian',
        userRoleKeys: ['guardian'],
        existingProfileKinds: ['guardian'],
        addablePersonas: [],
        reasons: {
          educator: 'missing-role',
          guardian: 'already-exists',
          child: 'missing-role',
          staff: 'missing-role',
        },
      },
    );
  });
});
