import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { OrgAiSettingsService } from './org-ai-settings.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createAiCompletionClient } from '@iconicedu/api/lib/ai/providers';
import { decryptSecret, encryptSecret } from '@iconicedu/api/lib/ai/secret-cipher';
import { requireAdminAccount } from '@iconicedu/api/lib/auth/require-admin-account';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/ai/providers', () => ({
  createAiCompletionClient: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/ai/secret-cipher', () => ({
  decryptSecret: jest.fn(),
  encryptSecret: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/auth/require-admin-account', () => ({
  requireAdminAccount: jest.fn(),
}));

const ORG_ID = 'org-1';
const AUTH_USER_ID = 'auth-user-1';
const ACCOUNT_ID = 'account-1';

function mockRow(row: unknown) {
  const chain: Record<string, unknown> = {};
  ['select', 'eq'].forEach((method) => {
    chain[method] = jest.fn(() => chain);
  });
  chain.maybeSingle = jest.fn(async () => ({ data: row, error: null }));
  jest
    .mocked(createSupabaseServiceClient)
    .mockReturnValue({ from: jest.fn(() => chain) } as never);
}

/** Mocks a sequence of row reads (e.g. "existing row" then "row after upsert") on successive `maybeSingle` calls, plus the upsert call itself. */
function mockRowSequence(rows: unknown[]) {
  const remaining = [...rows];
  const chain: Record<string, unknown> = {};
  ['select', 'eq'].forEach((method) => {
    chain[method] = jest.fn(() => chain);
  });
  chain.maybeSingle = jest.fn(async () => ({
    data: remaining.shift() ?? null,
    error: null,
  }));
  const upsert = jest.fn(async () => ({ error: null }));
  chain.upsert = upsert;
  jest
    .mocked(createSupabaseServiceClient)
    .mockReturnValue({ from: jest.fn(() => chain) } as never);
  return { upsert };
}

const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    AI_PROVIDER_KEY_ENCRYPTION_KEY: 'test-encryption-key',
  };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('OrgAiSettingsService', () => {
  beforeEach(() => {
    jest.mocked(createSupabaseServiceClient).mockReset();
    jest.mocked(createAiCompletionClient).mockReset();
    jest.mocked(decryptSecret).mockReset();
    jest
      .mocked(encryptSecret)
      .mockReset()
      .mockImplementation((plaintext) => `enc:${plaintext}`);
    jest
      .mocked(requireAdminAccount)
      .mockReset()
      .mockResolvedValue({ accountId: ACCOUNT_ID });
  });

  it('reports disabled when no settings row exists', async () => {
    mockRow(null);
    const service = new OrgAiSettingsService();

    expect(await service.isEnabledForOrg(ORG_ID)).toBe(false);
  });

  it('reports disabled when messaging features are off, even with a key configured', async () => {
    mockRow({
      provider: 'anthropic',
      model: null,
      api_key_ciphertext: 'v1.iv.tag.data',
      messaging_features_enabled: false,
    });
    const service = new OrgAiSettingsService();

    expect(await service.isEnabledForOrg(ORG_ID)).toBe(false);
  });

  it('reports disabled when enabled but no key has been saved', async () => {
    mockRow({
      provider: 'anthropic',
      model: null,
      api_key_ciphertext: null,
      messaging_features_enabled: true,
    });
    const service = new OrgAiSettingsService();

    expect(await service.isEnabledForOrg(ORG_ID)).toBe(false);
  });

  it('reports enabled and decrypts the key when fully configured', async () => {
    mockRow({
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      api_key_ciphertext: 'v1.iv.tag.data',
      messaging_features_enabled: true,
    });
    jest.mocked(decryptSecret).mockReturnValue('sk-ant-real-key');

    const service = new OrgAiSettingsService();
    expect(await service.isEnabledForOrg(ORG_ID)).toBe(true);
    expect(decryptSecret).toHaveBeenCalledWith('v1.iv.tag.data', 'test-encryption-key');
  });

  it('completeForOrg throws when the org is not configured', async () => {
    mockRow(null);
    const service = new OrgAiSettingsService();

    await expect(
      service.completeForOrg(ORG_ID, { system: 'sys', userContent: 'hi' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(createAiCompletionClient).not.toHaveBeenCalled();
  });

  it('completeForOrg builds a client from the decrypted config and delegates the request', async () => {
    mockRow({
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      api_key_ciphertext: 'v1.iv.tag.data',
      messaging_features_enabled: true,
    });
    jest.mocked(decryptSecret).mockReturnValue('sk-ant-real-key');
    const complete = jest.fn().mockResolvedValue('the reply');
    jest.mocked(createAiCompletionClient).mockReturnValue({ complete });

    const service = new OrgAiSettingsService();
    const result = await service.completeForOrg(ORG_ID, {
      system: 'sys',
      userContent: 'hi',
    });

    expect(result).toBe('the reply');
    expect(createAiCompletionClient).toHaveBeenCalledWith({
      provider: 'anthropic',
      apiKey: 'sk-ant-real-key',
      model: 'claude-haiku-4-5-20251001',
    });
    expect(complete).toHaveBeenCalledWith({ system: 'sys', userContent: 'hi' });
  });

  it('caches settings for repeated calls within the TTL (does not re-query Supabase)', async () => {
    mockRow({
      provider: 'anthropic',
      model: null,
      api_key_ciphertext: 'v1.iv.tag.data',
      messaging_features_enabled: true,
    });
    jest.mocked(decryptSecret).mockReturnValue('sk-ant-real-key');

    const service = new OrgAiSettingsService();
    await service.isEnabledForOrg(ORG_ID);
    await service.isEnabledForOrg(ORG_ID);

    expect(createSupabaseServiceClient).toHaveBeenCalledTimes(1);
  });

  it('invalidates the runtime cache after a successful update so completions see the new settings immediately', async () => {
    mockRow(null);
    const service = new OrgAiSettingsService();
    expect(await service.isEnabledForOrg(ORG_ID)).toBe(false);

    mockRowSequence([
      null,
      {
        provider: 'anthropic',
        model: null,
        api_key_ciphertext: 'enc:sk-ant-key',
        api_key_last_four: 'skey',
        messaging_features_enabled: true,
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);
    await service.updateSettings(AUTH_USER_ID, ORG_ID, {
      orgId: ORG_ID,
      provider: 'anthropic',
      apiKey: 'sk-ant-key',
      messagingFeaturesEnabled: true,
    });

    mockRow({
      provider: 'anthropic',
      model: null,
      api_key_ciphertext: 'enc:sk-ant-key',
      messaging_features_enabled: true,
    });
    jest.mocked(decryptSecret).mockReturnValue('sk-ant-key');
    expect(await service.isEnabledForOrg(ORG_ID)).toBe(true);
  });
});

describe('OrgAiSettingsService.getAdminView', () => {
  beforeEach(() => {
    jest.mocked(createSupabaseServiceClient).mockReset();
    jest
      .mocked(requireAdminAccount)
      .mockReset()
      .mockResolvedValue({ accountId: ACCOUNT_ID });
  });

  it('requires admin access before returning settings', async () => {
    mockRow(null);
    const service = new OrgAiSettingsService();

    await service.getAdminView(AUTH_USER_ID, ORG_ID);

    expect(requireAdminAccount).toHaveBeenCalledWith(AUTH_USER_ID, ORG_ID);
  });

  it('returns masked defaults when no settings row exists', async () => {
    mockRow(null);
    const service = new OrgAiSettingsService();

    const result = await service.getAdminView(AUTH_USER_ID, ORG_ID);

    expect(result).toEqual({
      orgId: ORG_ID,
      provider: 'anthropic',
      model: null,
      hasApiKey: false,
      apiKeyLastFour: null,
      messagingFeaturesEnabled: false,
      updatedAt: null,
    });
  });

  it('never includes the decrypted key in the admin view', async () => {
    mockRow({
      provider: 'openai',
      model: 'gpt-4o-mini',
      api_key_ciphertext: 'enc:sk-openai-secret',
      api_key_last_four: 'cret',
      messaging_features_enabled: true,
      updated_at: '2026-01-01T00:00:00Z',
    });
    const service = new OrgAiSettingsService();

    const result = await service.getAdminView(AUTH_USER_ID, ORG_ID);

    expect(result).toEqual({
      orgId: ORG_ID,
      provider: 'openai',
      model: 'gpt-4o-mini',
      hasApiKey: true,
      apiKeyLastFour: 'cret',
      messagingFeaturesEnabled: true,
      updatedAt: '2026-01-01T00:00:00Z',
    });
    expect(JSON.stringify(result)).not.toContain('sk-openai-secret');
  });
});

describe('OrgAiSettingsService.updateSettings', () => {
  beforeEach(() => {
    jest.mocked(createSupabaseServiceClient).mockReset();
    jest
      .mocked(encryptSecret)
      .mockReset()
      .mockImplementation((plaintext) => `enc:${plaintext}`);
    jest
      .mocked(requireAdminAccount)
      .mockReset()
      .mockResolvedValue({ accountId: ACCOUNT_ID });
  });

  it('rejects an invalid provider', async () => {
    const service = new OrgAiSettingsService();

    await expect(
      service.updateSettings(AUTH_USER_ID, ORG_ID, {
        orgId: ORG_ID,
        provider: 'not-a-provider' as never,
        messagingFeaturesEnabled: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a non-boolean messagingFeaturesEnabled', async () => {
    const service = new OrgAiSettingsService();

    await expect(
      service.updateSettings(AUTH_USER_ID, ORG_ID, {
        orgId: ORG_ID,
        provider: 'anthropic',
        messagingFeaturesEnabled: 'yes' as never,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a provider switch without a new API key — the old key is meaningless to the new provider', async () => {
    mockRowSequence([
      {
        provider: 'anthropic',
        model: null,
        api_key_ciphertext: 'enc:old-anthropic-key',
        api_key_last_four: 'd-key',
        messaging_features_enabled: true,
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);
    const service = new OrgAiSettingsService();

    await expect(
      service.updateSettings(AUTH_USER_ID, ORG_ID, {
        orgId: ORG_ID,
        provider: 'openai',
        messagingFeaturesEnabled: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows a provider switch when a new API key is provided', async () => {
    const { upsert } = mockRowSequence([
      {
        provider: 'anthropic',
        model: null,
        api_key_ciphertext: 'enc:old-anthropic-key',
        api_key_last_four: 'd-key',
        messaging_features_enabled: true,
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        api_key_ciphertext: 'enc:sk-openai-new1234',
        api_key_last_four: '1234',
        messaging_features_enabled: true,
        updated_at: '2026-01-02T00:00:00Z',
      },
    ]);
    const service = new OrgAiSettingsService();

    const result = await service.updateSettings(AUTH_USER_ID, ORG_ID, {
      orgId: ORG_ID,
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-openai-new1234',
      messagingFeaturesEnabled: true,
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: ORG_ID,
        provider: 'openai',
        model: 'gpt-4o-mini',
        messaging_features_enabled: true,
        updated_by: ACCOUNT_ID,
        api_key_ciphertext: 'enc:sk-openai-new1234',
        api_key_last_four: '1234',
      }),
      { onConflict: 'org_id' },
    );
    expect(upsert.mock.calls[0][0]).not.toHaveProperty('created_by');
    expect(result.provider).toBe('openai');
    expect(result.hasApiKey).toBe(true);
  });

  it('rejects enabling messaging features when there is no API key at all', async () => {
    mockRowSequence([null]);
    const service = new OrgAiSettingsService();

    await expect(
      service.updateSettings(AUTH_USER_ID, ORG_ID, {
        orgId: ORG_ID,
        provider: 'anthropic',
        messagingFeaturesEnabled: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sets created_by and updated_by to the admin account id when creating a new row', async () => {
    const { upsert } = mockRowSequence([
      null,
      {
        provider: 'anthropic',
        model: null,
        api_key_ciphertext: 'enc:sk-new1',
        api_key_last_four: 'new1',
        messaging_features_enabled: false,
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);
    const service = new OrgAiSettingsService();

    await service.updateSettings(AUTH_USER_ID, ORG_ID, {
      orgId: ORG_ID,
      provider: 'anthropic',
      apiKey: 'sk-new1',
      messagingFeaturesEnabled: false,
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ created_by: ACCOUNT_ID, updated_by: ACCOUNT_ID }),
      { onConflict: 'org_id' },
    );
  });

  it('keeps the existing key untouched when no new key is provided and the provider is unchanged', async () => {
    const { upsert } = mockRowSequence([
      {
        provider: 'anthropic',
        model: null,
        api_key_ciphertext: 'enc:old-key',
        api_key_last_four: 'old1',
        messaging_features_enabled: true,
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        provider: 'anthropic',
        model: null,
        api_key_ciphertext: 'enc:old-key',
        api_key_last_four: 'old1',
        messaging_features_enabled: false,
        updated_at: '2026-01-02T00:00:00Z',
      },
    ]);
    const service = new OrgAiSettingsService();

    await service.updateSettings(AUTH_USER_ID, ORG_ID, {
      orgId: ORG_ID,
      provider: 'anthropic',
      messagingFeaturesEnabled: false,
    });

    const [payload] = upsert.mock.calls[0];
    expect(payload).not.toHaveProperty('created_by');
    expect(payload).not.toHaveProperty('api_key_ciphertext');
  });
});
