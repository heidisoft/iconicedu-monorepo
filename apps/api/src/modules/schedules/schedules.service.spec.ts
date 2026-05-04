import { ForbiddenException } from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { SchedulesService } from '@iconicedu/api/modules/schedules/schedules.service';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));

describe('SchedulesService authorization', () => {
  const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);
  const createSupabaseSessionClientMock = jest.mocked(createSupabaseSessionClient);

  function makeSingleResult<T>(result: T) {
    const chain = {
      from: jest.fn(() => chain),
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      is: jest.fn(() => chain),
      maybeSingle: jest.fn(async () => ({ data: result, error: null })),
      returns: jest.fn(async () => ({ data: result, error: null })),
    };
    return chain;
  }

  async function requireOrgActorWithRoles(roleKeys: string[]) {
    createSupabaseSessionClientMock.mockReturnValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'auth-user-1' } },
          error: null,
        })),
      },
    } as never);
    createSupabaseServiceClientMock
      .mockReturnValueOnce(makeSingleResult({ id: 'account-1' }) as never)
      .mockReturnValueOnce(
        makeSingleResult(roleKeys.map((role_key) => ({ role_key }))) as never,
      );

    const service = new SchedulesService();
    await (
      service as unknown as {
        requireOrgActor(accessToken: string, orgId: string): Promise<void>;
      }
    ).requireOrgActor('token-1', 'org-1');
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['owner', 'admin', 'staff'])(
    'allows %s to manage learning-space schedules',
    async (roleKey) => {
      await expect(requireOrgActorWithRoles([roleKey])).resolves.toBeUndefined();
    },
  );

  it('rejects non-manager org members', async () => {
    await expect(requireOrgActorWithRoles(['guardian'])).rejects.toThrow(
      ForbiddenException,
    );
  });
});
