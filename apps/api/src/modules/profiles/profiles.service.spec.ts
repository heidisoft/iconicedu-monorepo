import { ForbiddenException } from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { ProfilesService } from '@iconicedu/api/modules/profiles/profiles.service';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));

describe('ProfilesService.ensureSystemProfile', () => {
  const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);
  const createSupabaseSessionClientMock = jest.mocked(createSupabaseSessionClient);

  function makeSingleResult<T>(result: T) {
    const chain = {
      from: jest.fn(() => chain),
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      is: jest.fn(() => chain),
      order: jest.fn(() => chain),
      limit: jest.fn(() => chain),
      maybeSingle: jest.fn(async () => ({ data: result, error: null })),
      returns: jest.fn(async () => ({ data: result, error: null })),
    };
    return chain;
  }

  /** requireOrgManager reuses requireUser's single service client for both
   * the accounts and user_roles lookups, so this needs a table-aware mock
   * rather than the single-response makeSingleResult helper. */
  function makeRequireOrgManagerClient(roleKeys: string[]) {
    return {
      from: jest.fn((table: string) => {
        const chain = {
          select: jest.fn(() => chain),
          eq: jest.fn(() => chain),
          is: jest.fn(() => chain),
          maybeSingle: jest.fn(async () => {
            if (table === 'accounts') {
              return { data: { id: 'account-1' }, error: null };
            }
            return { data: null, error: null };
          }),
          returns: jest.fn(async () => {
            if (table === 'user_roles') {
              return { data: roleKeys.map((role_key) => ({ role_key })), error: null };
            }
            return { data: [], error: null };
          }),
        };
        return chain;
      }),
    };
  }

  function mockAuthorizedActor(roleKeys: string[]) {
    createSupabaseSessionClientMock.mockReturnValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'auth-user-1' } },
          error: null,
        })),
      },
    } as never);
    createSupabaseServiceClientMock.mockReturnValueOnce(
      makeRequireOrgManagerClient(roleKeys) as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the existing system profile id without inserting', async () => {
    mockAuthorizedActor(['owner']);

    const profilesLookup = makeSingleResult({ id: 'system-profile-1' });
    createSupabaseServiceClientMock.mockReturnValueOnce(profilesLookup as never);

    const service = new ProfilesService({} as never);
    const result = await service.ensureSystemProfile('token-1', 'org-1');

    expect(result).toEqual({ id: 'system-profile-1' });
    expect(profilesLookup.from).toHaveBeenCalledWith('profiles');
  });

  it('creates an account and profile when no system profile exists yet', async () => {
    mockAuthorizedActor(['staff']);

    const insertedAccount = { id: 'system-account-1' };
    const insertedProfile = { id: 'system-profile-new' };
    const client = {
      from: jest.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  is: jest.fn(() => ({
                    order: jest.fn(() => ({
                      limit: jest.fn(() => ({
                        maybeSingle: jest.fn(async () => ({ data: null, error: null })),
                      })),
                    })),
                  })),
                })),
              })),
            })),
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(async () => ({ data: insertedProfile, error: null })),
              })),
            })),
          };
        }
        if (table === 'accounts') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(async () => ({ data: insertedAccount, error: null })),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    createSupabaseServiceClientMock.mockReturnValueOnce(client as never);

    const service = new ProfilesService({} as never);
    const result = await service.ensureSystemProfile('token-1', 'org-1');

    expect(result).toEqual({ id: 'system-profile-new' });
    expect(client.from).toHaveBeenCalledWith('accounts');
    expect(client.from).toHaveBeenCalledWith('profiles');
  });

  it('rejects non-manager roles', async () => {
    mockAuthorizedActor(['guardian']);

    const service = new ProfilesService({} as never);
    await expect(service.ensureSystemProfile('token-1', 'org-1')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
