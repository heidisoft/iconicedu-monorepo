import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { AccountsService } from '@iconicedu/api/modules/accounts/accounts.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';

jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const createSupabaseSessionClientMock =
  createSupabaseSessionClient as jest.MockedFunction<typeof createSupabaseSessionClient>;
const createSupabaseServiceClientMock =
  createSupabaseServiceClient as jest.MockedFunction<typeof createSupabaseServiceClient>;

type Chain = {
  select: jest.Mock;
  eq: jest.Mock;
  is: jest.Mock;
  in: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

function createChain(result: unknown, terminal: 'in' | 'is' = 'is'): Chain {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    is: jest.fn(() => (terminal === 'is' ? Promise.resolve(result) : chain)),
    in: jest.fn(() => (terminal === 'in' ? Promise.resolve(result) : chain)),
    update: jest.fn(() => chain),
    delete: jest.fn(() => chain),
  };
  return chain;
}

describe('AccountsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('deleteMe', () => {
    it('anonymizes account/profile rows, deletes push tokens, and deletes the auth user', async () => {
      const accountSelect = createChain({
        data: [{ id: 'account-1' }, { id: 'account-2' }],
        error: null,
      });
      const profileSelect = createChain({
        data: [{ id: 'profile-1' }, { id: 'profile-2' }],
        error: null,
      });
      const pushTokenDelete = createChain({ data: null, error: null }, 'in');
      const profileUpdate = createChain({ data: null, error: null }, 'in');
      const accountUpdate = createChain({ data: null, error: null }, 'in');
      const from = jest
        .fn()
        .mockReturnValueOnce(accountSelect)
        .mockReturnValueOnce(profileSelect)
        .mockReturnValueOnce(pushTokenDelete)
        .mockReturnValueOnce(profileUpdate)
        .mockReturnValueOnce(accountUpdate);
      const deleteUser = jest.fn().mockResolvedValue({ data: {}, error: null });

      createSupabaseSessionClientMock.mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'auth-user-1' } },
            error: null,
          }),
        },
      } as never);
      createSupabaseServiceClientMock.mockReturnValue({
        from,
        auth: { admin: { deleteUser } },
      } as never);

      const result = await new AccountsService().deleteMe('token-1');

      expect(result.deletedAt).toEqual(expect.any(String));
      expect(accountSelect.eq).toHaveBeenCalledWith('auth_user_id', 'auth-user-1');
      expect(accountSelect.is).toHaveBeenCalledWith('deleted_at', null);
      expect(profileSelect.in).toHaveBeenCalledWith('account_id', [
        'account-1',
        'account-2',
      ]);
      expect(pushTokenDelete.delete).toHaveBeenCalled();
      expect(pushTokenDelete.in).toHaveBeenCalledWith('profile_id', [
        'profile-1',
        'profile-2',
      ]);
      expect(profileUpdate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: 'Deleted user',
          first_name: null,
          last_name: null,
          avatar_source: 'seed',
          status: 'deleted',
          deleted_at: result.deletedAt,
        }),
      );
      expect(accountUpdate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          auth_user_id: null,
          email: null,
          phone_e164: null,
          whatsapp_e164: null,
          status: 'deleted',
          deleted_at: result.deletedAt,
        }),
      );
      expect(deleteUser).toHaveBeenCalledWith('auth-user-1');
    });

    it('throws when no linked account exists', async () => {
      const accountSelect = createChain({ data: [], error: null });
      createSupabaseSessionClientMock.mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'auth-user-1' } },
            error: null,
          }),
        },
      } as never);
      createSupabaseServiceClientMock.mockReturnValue({
        from: jest.fn().mockReturnValueOnce(accountSelect),
        auth: { admin: { deleteUser: jest.fn() } },
      } as never);

      await expect(new AccountsService().deleteMe('token-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('surfaces Supabase service errors', async () => {
      const accountSelect = createChain({
        data: null,
        error: { message: 'database unavailable' },
      });
      createSupabaseSessionClientMock.mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'auth-user-1' } },
            error: null,
          }),
        },
      } as never);
      createSupabaseServiceClientMock.mockReturnValue({
        from: jest.fn().mockReturnValueOnce(accountSelect),
        auth: { admin: { deleteUser: jest.fn() } },
      } as never);

      await expect(new AccountsService().deleteMe('token-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('surfaces auth deletion errors after app rows are anonymized', async () => {
      const accountSelect = createChain({ data: [{ id: 'account-1' }], error: null });
      const profileSelect = createChain({ data: [], error: null });
      const accountUpdate = createChain({ data: null, error: null }, 'in');
      const from = jest
        .fn()
        .mockReturnValueOnce(accountSelect)
        .mockReturnValueOnce(profileSelect)
        .mockReturnValueOnce(accountUpdate);
      const deleteUser = jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'auth error' } });

      createSupabaseSessionClientMock.mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'auth-user-1' } },
            error: null,
          }),
        },
      } as never);
      createSupabaseServiceClientMock.mockReturnValue({
        from,
        auth: { admin: { deleteUser } },
      } as never);

      await expect(new AccountsService().deleteMe('token-1')).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(accountUpdate.update).toHaveBeenCalled();
      expect(deleteUser).toHaveBeenCalledWith('auth-user-1');
    });
  });
});
