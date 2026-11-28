import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FamilyChildInvitesService } from './family-child-invites.service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import type { NotificationPreferencesService } from '@iconicedu/api/modules/notification-preferences/notification-preferences.service';
jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));
const seedDefaults = jest.fn();
const service = new FamilyChildInvitesService({
  seedDefaults,
} as unknown as NotificationPreferencesService);
const rpc = jest.fn();
const inviteUserByEmail = jest.fn();
const signInWithOtp = jest.fn();
const deleteUser = jest.fn();
const getUser = jest.fn();
const row = {
  id: 'invite-id',
  org_id: 'org',
  family_id: 'family',
  invited_role: 'child',
  invited_email: 'child@example.invalid',
  status: 'pending',
  expires_at: '2026-12-03T12:00:00Z',
  max_uses: 1,
  uses: 0,
  created_by_account_id: 'verified-parent',
  created_at: '2026-11-26T12:00:00Z',
  updated_at: '2026-11-26T12:00:00Z',
  invite_code_hash: 'private-hash',
};
let prepared = {
  invite: row,
  orgSlug: 'academy',
  profileId: 'child-profile',
  profileCreated: true,
  hasAuthAccount: false,
};
const previousWebURL = process.env.WEB_URL;
beforeEach(() => {
  jest.clearAllMocks();
  process.env.WEB_URL = 'https://academy.example.invalid';
  prepared = {
    invite: row,
    orgSlug: 'academy',
    profileId: 'child-profile',
    profileCreated: true,
    hasAuthAccount: false,
  };
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    single: jest
      .fn()
      .mockResolvedValue({ data: { id: 'verified-parent', org_id: 'org' }, error: null }),
  };
  getUser.mockResolvedValue({ data: { user: { id: 'auth-parent' } }, error: null });
  jest
    .mocked(createSupabaseSessionClient)
    .mockReturnValue({ auth: { getUser }, from: () => query } as unknown as ReturnType<
      typeof createSupabaseSessionClient
    >);
  rpc.mockImplementation((name: string) =>
    Promise.resolve({
      data: name === 'prepare_family_child_invite' ? prepared : null,
      error: null,
    }),
  );
  inviteUserByEmail.mockResolvedValue({ error: null });
  signInWithOtp.mockResolvedValue({ error: null });
  seedDefaults.mockResolvedValue({ success: true });
  jest.mocked(createSupabaseServiceClient).mockReturnValue({
    rpc,
    auth: { admin: { inviteUserByEmail, deleteUser }, signInWithOtp },
  } as unknown as ReturnType<typeof createSupabaseServiceClient>);
});
afterAll(() => {
  if (previousWebURL === undefined) delete process.env.WEB_URL;
  else process.env.WEB_URL = previousWebURL;
});
it('sends a web-compatible child invitation using only the verified actor and normalized email', async () => {
  const result = await service.send('token', {
    invitedEmail: ' Child@Example.Invalid ',
    orgId: 'another-org',
    invitedRole: 'guardian',
  } as { invitedEmail: string });
  expect(rpc).toHaveBeenCalledWith('prepare_family_child_invite', {
    actor_id: 'verified-parent',
    invited_email_input: 'child@example.invalid',
    target_profile_id: null,
  });
  expect(inviteUserByEmail).toHaveBeenCalledWith('child@example.invalid', {
    redirectTo:
      'https://academy.example.invalid/auth/callback?org=academy&intent=get-started',
  });
  expect(result).not.toHaveProperty('invite_code_hash');
});
it('does not mutate or send email for invalid addresses', async () => {
  await expect(service.send('token', { invitedEmail: 'bad' })).rejects.toBeInstanceOf(
    BadRequestException,
  );
  expect(rpc).not.toHaveBeenCalled();
  expect(inviteUserByEmail).not.toHaveBeenCalled();
});
it('does not use privileged calls for unauthenticated requests', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(
    service.send('token', { invitedEmail: 'child@example.invalid' }),
  ).rejects.toBeInstanceOf(ForbiddenException);
  expect(rpc).not.toHaveBeenCalled();
});
it.each([
  ['42501', ForbiddenException],
  ['23505', ConflictException],
])(
  'preserves database authorization/deduplication failure %s',
  async (code, ErrorType) => {
    rpc.mockResolvedValue({ data: null, error: { code } });
    await expect(
      service.send('token', { invitedEmail: 'child@example.invalid' }),
    ).rejects.toBeInstanceOf(ErrorType);
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  },
);
it('sends existing children a sign-in link without resetting their account or preferences', async () => {
  prepared.hasAuthAccount = true;
  prepared.profileCreated = false;
  await service.send('token', { invitedEmail: 'child@example.invalid' });
  expect(signInWithOtp).toHaveBeenCalledWith({
    email: 'child@example.invalid',
    options: {
      shouldCreateUser: false,
      emailRedirectTo: expect.stringContaining('/auth/callback?org=academy'),
    },
  });
  expect(inviteUserByEmail).not.toHaveBeenCalled();
  expect(seedDefaults).not.toHaveBeenCalled();
  expect(deleteUser).not.toHaveBeenCalled();
});
it('revokes pending records when mail delivery fails and never deletes authentication users', async () => {
  inviteUserByEmail.mockResolvedValue({ error: { code: 'over_email_send_rate_limit' } });
  await expect(
    service.send('token', { invitedEmail: 'child@example.invalid' }),
  ).rejects.toBeInstanceOf(ServiceUnavailableException);
  expect(rpc).toHaveBeenCalledWith('revoke_family_child_invite', {
    actor_id: 'verified-parent',
    invite_id: 'invite-id',
  });
  expect(deleteUser).not.toHaveBeenCalled();
});
it('does not send mail if default preference initialization fails', async () => {
  seedDefaults.mockRejectedValueOnce(new Error('storage failure'));
  await expect(
    service.send('token', { invitedEmail: 'child@example.invalid' }),
  ).rejects.toBeInstanceOf(ServiceUnavailableException);
  expect(inviteUserByEmail).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledWith('revoke_family_child_invite', expect.any(Object));
});
it('handles a previously invited auth user through a sign-in link', async () => {
  inviteUserByEmail.mockResolvedValue({ error: { code: 'user_already_exists' } });
  await service.send('token', { invitedEmail: 'child@example.invalid' });
  expect(signInWithOtp).toHaveBeenCalledTimes(1);
  expect(deleteUser).not.toHaveBeenCalled();
});
it('revokes only the caller-owned invitation', async () => {
  await service.revoke('token', 'invite-id');
  expect(rpc).toHaveBeenCalledWith('revoke_family_child_invite', {
    actor_id: 'verified-parent',
    invite_id: 'invite-id',
  });
  expect(deleteUser).not.toHaveBeenCalled();
});

it('rejects invalid web callback configuration before preparing or sending an invitation', async () => {
  process.env.WEB_URL = 'not-a-url';
  await expect(
    service.send('token', { invitedEmail: 'child@example.invalid' }),
  ).rejects.toBeInstanceOf(ServiceUnavailableException);
  expect(rpc).not.toHaveBeenCalled();
  expect(inviteUserByEmail).not.toHaveBeenCalled();
});
