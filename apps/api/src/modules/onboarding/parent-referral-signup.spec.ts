import { OnboardingService } from './onboarding.service';
const code = 'a'.repeat(48);
const actorId = 'test-verified-auth-id';
const orgId = 'test-organization';
function setup(completed = false) {
  const referrals = {
    resolve: jest.fn().mockResolvedValue({ orgSlug: 'inviting-academy' }),
    record: jest.fn(),
    hasMatchingSignupReferral: jest.fn().mockResolvedValue(false),
  };
  const notifications = { seedDefaults: jest.fn() };
  const service = new OnboardingService(
    notifications as unknown as ConstructorParameters<typeof OnboardingService>[0],
    referrals as unknown as ConstructorParameters<typeof OnboardingService>[1],
  );
  const mocks = {
    requireUser: jest.fn().mockResolvedValue({
      user: { id: actorId, email: 'parent@example.invalid' },
      serviceSupabase: {},
    }),
    resolveOrgIdForUser: jest.fn().mockResolvedValue(orgId),
    getOrCreateAccount: jest.fn().mockResolvedValue({
      id: 'parent-account',
      org_id: orgId,
      primary_role: completed ? 'guardian' : null,
      onboarding_completed_at: completed ? '2026-01-01T00:00:00Z' : null,
    }),
    ensureProfile: jest
      .fn()
      .mockResolvedValue({ id: 'parent-profile', kind: 'guardian' }),
    upsertUserRole: jest.fn(),
    updateAccountRoleState: jest.fn().mockResolvedValue({
      id: 'parent-account',
      org_id: orgId,
      primary_role: 'guardian',
      role_status: 'active',
      onboarding_completed_at: '2026-01-01T00:00:00Z',
    }),
    getUserRoles: jest.fn().mockResolvedValue([]),
    resolveOnboardingDestinations: jest.fn().mockResolvedValue({}),
  };
  Object.assign(service, mocks);
  return { service, referrals, mocks };
}
it('derives the signup organization from the invitation and records the verified actor for review', async () => {
  const { service, referrals, mocks } = setup();
  const result = await service.completeRole('verified-token', {
    role: 'parent',
    referralCode: code,
  });
  expect(mocks.resolveOrgIdForUser).toHaveBeenCalledWith({}, actorId, 'inviting-academy');
  expect(referrals.record).toHaveBeenCalledWith(actorId, orgId, {
    role: 'parent',
    referralCode: code,
  });
  expect(result.referralStatus).toBe('pending_review');
});
it('rejects a mismatched organization before account creation', async () => {
  const { service, referrals, mocks } = setup();
  await expect(
    service.completeRole(
      'token',
      { role: 'parent', referralCode: code },
      'another-academy',
    ),
  ).rejects.toMatchObject({ status: 400 });
  expect(mocks.getOrCreateAccount).not.toHaveBeenCalled();
  expect(referrals.record).not.toHaveBeenCalled();
});
it('does not create a reward for an already onboarded account', async () => {
  const { service, referrals, mocks } = setup(true);
  expect(
    (await service.completeRole('token', { role: 'parent', referralCode: code }))
      .referralStatus,
  ).toBe('not_eligible');
  expect(referrals.record).not.toHaveBeenCalled();
  expect(mocks.ensureProfile).not.toHaveBeenCalled();
  expect(mocks.updateAccountRoleState).not.toHaveBeenCalled();
});
it('does not consume a parent invitation for another role', async () => {
  const { service, referrals, mocks } = setup();
  await expect(
    service.completeRole('token', { role: 'educator', referralCode: code }),
  ).rejects.toMatchObject({ status: 400 });
  expect(mocks.getOrCreateAccount).not.toHaveBeenCalled();
  expect(referrals.record).not.toHaveBeenCalled();
});
it('fails closed before writes when the invitation resolver rejects a disabled or revoked link', async () => {
  const { service, referrals, mocks } = setup();
  referrals.resolve.mockRejectedValueOnce(new Error('Unavailable'));
  await expect(
    service.completeRole('token', { role: 'parent', referralCode: code }),
  ).rejects.toThrow('Unavailable');
  expect(mocks.getOrCreateAccount).not.toHaveBeenCalled();
});

it('acknowledges an existing claim on a retry without mutating the account or credit', async () => {
  const { service, referrals, mocks } = setup(true);
  referrals.hasMatchingSignupReferral.mockResolvedValueOnce(true);
  expect(
    (await service.completeRole('token', { role: 'parent', referralCode: code }))
      .referralStatus,
  ).toBe('already_recorded');
  expect(referrals.record).not.toHaveBeenCalled();
  expect(mocks.updateAccountRoleState).not.toHaveBeenCalled();
});

it('completes an unassigned parent account normally after the invitation is removed', async () => {
  const { service, referrals, mocks } = setup();
  const result = await service.completeRole('token', { role: 'parent' });
  expect(result.referralStatus).toBeUndefined();
  expect(referrals.resolve).not.toHaveBeenCalled();
  expect(mocks.updateAccountRoleState).toHaveBeenCalledWith(
    {},
    expect.objectContaining({ primaryRole: 'guardian' }),
  );
});
