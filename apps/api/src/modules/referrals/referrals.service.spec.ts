import { ReferralsService, normalizeReferralInput } from './referrals.service';
const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockUser = jest.fn();
const mockFlag = jest.fn();
jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: () => ({ rpc: mockRpc, from: mockFrom }),
}));
jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: () => ({ auth: { getUser: mockUser } }),
}));
jest.mock('@iconicedu/api/lib/flags/posthog-openfeature', () => ({
  evaluateApiBooleanFlag: (...args: unknown[]) => mockFlag(...args),
}));
const org = 'f1000000-0000-4000-8000-000000000001';
const user = 'f2000000-0000-4000-8000-000000000001';
const code = 'a'.repeat(48);
beforeEach(() => {
  jest.clearAllMocks();
  mockFlag.mockResolvedValue(true);
  mockRpc.mockResolvedValue({ data: { code }, error: null });
  mockUser.mockResolvedValue({ data: { user: { id: user } }, error: null });
});
it('normalizes an optional parent name without matching it to an account', () => {
  expect(normalizeReferralInput({ referrerName: '  Test Parent  ' })).toEqual({
    code: null,
    name: 'Test Parent',
  });
  expect(normalizeReferralInput({})).toEqual({ code: null, name: null });
});
it.each([
  { referrerName: 'a' },
  { referrerName: '<'.repeat(101) },
  { referrerName: 'A\u0000B' },
  { referralCode: '../../admin' },
  { referralCode: user },
])('rejects invalid attribution input %j', (input) => {
  expect(() => normalizeReferralInput(input)).toThrow();
});
it('fails closed when the referral flag is off', async () => {
  mockFlag.mockResolvedValue(false);
  await expect(new ReferralsService().link('token', org)).rejects.toMatchObject({
    status: 404,
  });
  expect(mockRpc).not.toHaveBeenCalled();
});
it('creates a website link using a verified actor and explicit organization', async () => {
  const previous = process.env.WEB_URL;
  process.env.WEB_URL = 'https://academy.example.invalid';
  try {
    const result = await new ReferralsService().link('token', org);
    expect(result.url).toBe(`https://academy.example.invalid/r/${code}`);
    expect(result.rewardLabel).toBe('$20 off');
    expect(mockRpc).toHaveBeenCalledWith('get_parent_referral_link', {
      actor_auth_id: user,
      target_org_id: org,
    });
  } finally {
    if (previous === undefined) delete process.env.WEB_URL;
    else process.env.WEB_URL = previous;
  }
});
it('rejects invalid organization IDs before any database mutation', async () => {
  await expect(new ReferralsService().link('token', 'not-an-org')).rejects.toMatchObject({
    status: 400,
  });
  expect(mockRpc).not.toHaveBeenCalled();
});
it('does not trust an unverified authentication session', async () => {
  mockUser.mockResolvedValue({ data: { user: null }, error: new Error('expired') });
  await expect(new ReferralsService().link('token', org)).rejects.toMatchObject({
    status: 403,
  });
  expect(mockRpc).not.toHaveBeenCalled();
});
it('enforces guardian permission failures returned by the database', async () => {
  mockRpc.mockResolvedValue({ error: { code: '42501' } });
  await expect(new ReferralsService().link('token', org)).rejects.toMatchObject({
    status: 403,
  });
});
it('does not expose unknown links or call the database for malformed codes', async () => {
  await expect(new ReferralsService().resolve('bad')).rejects.toMatchObject({
    status: 404,
  });
  expect(mockRpc).not.toHaveBeenCalled();
  mockRpc.mockResolvedValue({ data: null, error: null });
  await expect(new ReferralsService().resolve(code)).rejects.toMatchObject({
    status: 404,
  });
});
it('skips blank optional referral details', async () => {
  await new ReferralsService().record(user, org, { referrerName: '' });
  expect(mockRpc).not.toHaveBeenCalled();
});
it('sends referral claims through the actor-scoped transactional function', async () => {
  await new ReferralsService().record(user, org, { referralCode: code });
  expect(mockRpc).toHaveBeenCalledWith('record_parent_referral', {
    actor_auth_id: user,
    target_org_id: org,
    code_value: code,
    name_value: null,
  });
});
it('requires a confirmation note for staff review', async () => {
  await expect(
    new ReferralsService().review('token', org, { status: 'fulfilled', note: '' }),
  ).rejects.toMatchObject({ status: 400 });
  expect(mockRpc).not.toHaveBeenCalled();
});
it('maps review authorization failures to forbidden rather than updating a referral', async () => {
  mockRpc.mockResolvedValue({ error: { code: '42501' } });
  await expect(
    new ReferralsService().review('token', org, {
      status: 'approved',
      note: 'Confirmed parent',
    }),
  ).rejects.toMatchObject({ status: 403 });
});

it('reports a lookup outage as retryable instead of treating a valid code as missing', async () => {
  mockRpc.mockResolvedValueOnce({
    data: null,
    error: { message: 'Database unavailable' },
  });
  await expect(new ReferralsService().resolve(code)).rejects.toMatchObject({
    status: 503,
  });
});

it.each(['offer', 'resolve', 'record', 'review', 'list'] as const)(
  'blocks %s when the referral flag is off',
  async (action) => {
    mockFlag.mockResolvedValue(false);
    const service = new ReferralsService();
    const operations = {
      offer: () => service.offer(),
      resolve: () => service.resolve(code),
      record: () => service.record(user, org, { referralCode: code }),
      review: () =>
        service.review('token', org, { status: 'approved', note: 'Verified parent' }),
      list: () => service.list('token', org),
    };
    await expect(operations[action]()).rejects.toMatchObject({ status: 404 });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFlag).toHaveBeenCalledWith(
      expect.objectContaining({ allowLocalOverride: false }),
    );
  },
);

it('recognizes an already recorded matching link without writing another reward', async () => {
  const maybeSingle = jest
    .fn()
    .mockResolvedValueOnce({
      data: { referrer_account_id: 'referrer-account', attribution_source: 'link' },
      error: null,
    })
    .mockResolvedValueOnce({
      data: { referrer_account_id: 'referrer-account' },
      error: null,
    });
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle,
  };
  mockFrom.mockReturnValue(query);
  expect(
    await new ReferralsService().hasMatchingSignupReferral('new-parent-account', org, {
      referralCode: code,
    }),
  ).toBe(true);
  expect(query.eq).toHaveBeenCalledWith('org_id', org);
  expect(query.eq).toHaveBeenCalledWith('referred_account_id', 'new-parent-account');
  expect(mockRpc).not.toHaveBeenCalled();
});
it('does not treat a different invitation as the recorded referral', async () => {
  const maybeSingle = jest
    .fn()
    .mockResolvedValueOnce({
      data: { referrer_account_id: 'original-parent', attribution_source: 'link' },
      error: null,
    })
    .mockResolvedValueOnce({
      data: { referrer_account_id: 'different-parent' },
      error: null,
    });
  mockFrom.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle,
  });
  expect(
    await new ReferralsService().hasMatchingSignupReferral('new-parent-account', org, {
      referralCode: code,
    }),
  ).toBe(false);
});
