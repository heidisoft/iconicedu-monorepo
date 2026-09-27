import { ServiceUnavailableException } from '@nestjs/common';
import { OrgAiSettingsService } from './org-ai-settings.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createAiCompletionClient } from '@iconicedu/api/lib/ai/providers';
import { decryptSecret } from '@iconicedu/api/lib/ai/secret-cipher';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/ai/providers', () => ({
  createAiCompletionClient: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/ai/secret-cipher', () => ({
  decryptSecret: jest.fn(),
}));

const ORG_ID = 'org-1';

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

describe('OrgAiSettingsService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AI_PROVIDER_KEY_ENCRYPTION_KEY: 'test-encryption-key',
    };
    jest.mocked(createSupabaseServiceClient).mockReset();
    jest.mocked(createAiCompletionClient).mockReset();
    jest.mocked(decryptSecret).mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
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
});
