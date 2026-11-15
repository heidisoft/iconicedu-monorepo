import { NotificationPreferencesService } from '@iconicedu/api/modules/notification-preferences/notification-preferences.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));

const ORG_ID = 'org-1';
const PROFILE_ID = 'profile-1';
const ACCOUNT_ID = 'account-1';
const AUTH_USER_ID = 'auth-user-1';

/** A thenable, chainable stand-in for a plain read query (no .single()/.maybeSingle() call). */
function makeSelectChain(result: { data: unknown; error: null }) {
  const chain: Record<string, unknown> = {};
  ['select', 'eq', 'is', 'in'].forEach((method) => {
    chain[method] = jest.fn(() => chain);
  });
  chain.maybeSingle = jest.fn(async () => result);
  (chain as { then: (...args: unknown[]) => Promise<unknown> }).then = (
    resolve,
    reject,
  ) => Promise.resolve(result).then(resolve as never, reject as never);
  return chain;
}

/**
 * A chain that serves both the "read existing scoped rows" query (thenable,
 * resolves `selectResult`) and every `upsertScope` write against the same
 * table (`.upsert(...).select('*').single()`, resolves `upsertResult`), so
 * every `.upsert()` call across the fan-out is recorded on one mock.
 */
function makeScopesChain(
  selectResult: { data: unknown; error: null },
  upsertResult: { data: unknown; error: null },
) {
  const chain: Record<string, unknown> = {};
  ['select', 'eq', 'is', 'in', 'upsert'].forEach((method) => {
    chain[method] = jest.fn(() => chain);
  });
  chain.single = jest.fn(async () => upsertResult);
  (chain as { then: (...args: unknown[]) => Promise<unknown> }).then = (
    resolve,
    reject,
  ) => Promise.resolve(selectResult).then(resolve as never, reject as never);
  return chain;
}

describe('NotificationPreferencesService.setConversationMode', () => {
  const mockedCreateSessionClient = createSupabaseSessionClient as jest.Mock;
  const mockedCreateServiceClient = createSupabaseServiceClient as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateSessionClient.mockReturnValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: AUTH_USER_ID } },
          error: null,
        })),
      },
    });
  });

  it('seeds a pref key with no existing rows from its global channel preference, not a hard-coded push-only default', async () => {
    const accountsChain = makeSelectChain({
      data: {
        id: ACCOUNT_ID,
        org_id: ORG_ID,
        primary_role: null,
        active_profile_id: PROFILE_ID,
      },
      error: null,
    });
    const scopesChain = makeScopesChain(
      { data: [], error: null },
      { data: { id: 'scope-row-1' }, error: null },
    );
    const globalChain = makeSelectChain({
      data: [{ pref_key: 'message.posted', channels: ['push', 'email'] }],
      error: null,
    });

    mockedCreateServiceClient.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'accounts') return accountsChain;
        if (table === 'notification_preference_scopes') return scopesChain;
        if (table === 'notification_preferences') return globalChain;
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const service = new NotificationPreferencesService();
    await service.setConversationMode('token', {
      orgId: ORG_ID,
      profileId: PROFILE_ID,
      scopeKind: 'channel',
      scopeId: 'channel-1',
      mode: 'mentions_only',
    });

    const upsertCalls = (scopesChain.upsert as jest.Mock).mock.calls as Array<
      [{ pref_key: string; channels: string[] }]
    >;

    // Has a global preference row: inherits its channels (push + email),
    // not just ['push'].
    const messagePostedCall = upsertCalls.find(
      ([payload]) => payload.pref_key === 'message.posted',
    );
    expect(messagePostedCall?.[0].channels).toEqual(
      expect.arrayContaining(['push', 'email']),
    );

    // No scoped row and no global row: falls back to the signup default for
    // that pref key (push + email), not a bare ['push'].
    const fileUploadedCall = upsertCalls.find(
      ([payload]) => payload.pref_key === 'file.uploaded',
    );
    expect(fileUploadedCall?.[0].channels).toEqual(
      expect.arrayContaining(['push', 'email']),
    );
  });

  it('preserves an already-scoped pref key channels rather than overwriting them from global', async () => {
    const accountsChain = makeSelectChain({
      data: {
        id: ACCOUNT_ID,
        org_id: ORG_ID,
        primary_role: null,
        active_profile_id: PROFILE_ID,
      },
      error: null,
    });
    const scopesChain = makeScopesChain(
      {
        data: [{ pref_key: 'message.posted', channels: ['sms'] }],
        error: null,
      },
      { data: { id: 'scope-row-1' }, error: null },
    );
    const globalChain = makeSelectChain({
      data: [{ pref_key: 'message.posted', channels: ['push', 'email'] }],
      error: null,
    });

    mockedCreateServiceClient.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'accounts') return accountsChain;
        if (table === 'notification_preference_scopes') return scopesChain;
        if (table === 'notification_preferences') return globalChain;
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const service = new NotificationPreferencesService();
    await service.setConversationMode('token', {
      orgId: ORG_ID,
      profileId: PROFILE_ID,
      scopeKind: 'channel',
      scopeId: 'channel-1',
      mode: 'mentions_only',
    });

    const upsertCalls = (scopesChain.upsert as jest.Mock).mock.calls as Array<
      [{ pref_key: string; channels: string[] }]
    >;
    const messagePostedCall = upsertCalls.find(
      ([payload]) => payload.pref_key === 'message.posted',
    );
    expect(messagePostedCall?.[0].channels).toEqual(['sms']);
  });
});
