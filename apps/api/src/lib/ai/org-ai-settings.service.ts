import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  AiProviderId,
  OrgAiSettingsVM,
  UpdateOrgAiSettingsInput,
} from '@iconicedu/shared-types';
import { decryptSecret, encryptSecret } from '@iconicedu/api/lib/ai/secret-cipher';
import { requireAdminAccount } from '@iconicedu/api/lib/auth/require-admin-account';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import {
  createAiCompletionClient,
  type AiCompletionRequest,
  type AiProviderConfig,
} from '@iconicedu/api/lib/ai/providers';

const CACHE_TTL_MS = 30_000;
const VALID_PROVIDERS = new Set<AiProviderId>(['anthropic', 'openai']);

type OrgAiProviderSettingsRow = {
  provider: AiProviderConfig['provider'];
  model: string | null;
  api_key_ciphertext: string | null;
  messaging_features_enabled: boolean;
};

type OrgAiProviderSettingsAdminRow = OrgAiProviderSettingsRow & {
  api_key_last_four: string | null;
  updated_at: string;
};

type CacheEntry = {
  config: AiProviderConfig | null;
  expiresAt: number;
};

function requireEncryptionKey(): string {
  const key = process.env.AI_PROVIDER_KEY_ENCRYPTION_KEY?.trim();
  if (!key) {
    throw new Error('AI_PROVIDER_KEY_ENCRYPTION_KEY is not configured');
  }
  return key;
}

/**
 * Resolves each org's own AI provider + model + API key (configured via the
 * admin settings page) and is the single place that turns those into a
 * ready-to-call completion client. Replaces the old process-wide
 * ANTHROPIC_API_KEY — every org brings its own key now, and AI-assist is
 * unavailable for an org until one is configured and enabled.
 */
@Injectable()
export class OrgAiSettingsService {
  private readonly logger = new Logger(OrgAiSettingsService.name);
  private readonly cache = new Map<string, CacheEntry>();

  async isEnabledForOrg(orgId: string): Promise<boolean> {
    const config = await this.getRuntimeConfig(orgId);
    return config !== null;
  }

  async completeForOrg(orgId: string, request: AiCompletionRequest): Promise<string> {
    const config = await this.getRuntimeConfig(orgId);
    if (!config) {
      throw new ServiceUnavailableException(
        'AI assist is not configured for this organization',
      );
    }
    const client = createAiCompletionClient(config);
    return client.complete(request);
  }

  /** Masked settings for the admin settings page — never includes the decrypted key. */
  async getAdminView(authUserId: string, orgId: string): Promise<OrgAiSettingsVM> {
    await requireAdminAccount(authUserId, orgId);
    const row = await this.fetchAdminRow(orgId);
    return this.toAdminVm(orgId, row);
  }

  /**
   * Validates and persists an org's AI settings. A provider switch always
   * requires a fresh key — a key saved for one provider is meaningless to
   * another, so carrying it over would silently send the wrong provider's
   * credential on every subsequent request.
   */
  async updateSettings(
    authUserId: string,
    orgId: string,
    input: UpdateOrgAiSettingsInput,
  ): Promise<OrgAiSettingsVM> {
    const { accountId } = await requireAdminAccount(authUserId, orgId);

    if (!VALID_PROVIDERS.has(input.provider)) {
      throw new BadRequestException('A valid provider is required.');
    }
    if (typeof input.messagingFeaturesEnabled !== 'boolean') {
      throw new BadRequestException('messagingFeaturesEnabled must be a boolean.');
    }

    const existingRow = await this.fetchAdminRow(orgId);
    const isNewRow = existingRow === null;
    const trimmedApiKey = input.apiKey?.trim();
    const providerChanged =
      existingRow !== null && existingRow.provider !== input.provider;

    if (providerChanged && !trimmedApiKey) {
      throw new BadRequestException(
        "Enter a new API key when switching providers — the key saved for the previous provider won't work with the new one.",
      );
    }

    const willHaveApiKey =
      Boolean(trimmedApiKey) ||
      (Boolean(existingRow?.api_key_ciphertext) && !providerChanged);
    if (input.messagingFeaturesEnabled && !willHaveApiKey) {
      throw new BadRequestException(
        'Add an API key before enabling AI message features.',
      );
    }

    const upsertPayload: Record<string, unknown> = {
      org_id: orgId,
      provider: input.provider,
      model: input.model?.trim() || null,
      messaging_features_enabled: input.messagingFeaturesEnabled,
      updated_by: accountId,
      ...(isNewRow ? { created_by: accountId } : {}),
    };
    if (trimmedApiKey) {
      upsertPayload.api_key_ciphertext = encryptSecret(
        trimmedApiKey,
        requireEncryptionKey(),
      );
      upsertPayload.api_key_last_four = trimmedApiKey.slice(-4);
    }

    const serviceSupabase = createSupabaseServiceClient();
    const { error } = await serviceSupabase
      .from('org_ai_provider_settings')
      .upsert(upsertPayload, { onConflict: 'org_id' });
    if (error) throw new InternalServerErrorException(error.message);

    // Otherwise a completion in flight right now would keep using the old
    // key/provider/toggle state until the TTL naturally expires.
    this.invalidateCache(orgId);

    const updatedRow = await this.fetchAdminRow(orgId);
    return this.toAdminVm(orgId, updatedRow);
  }

  invalidateCache(orgId: string): void {
    this.cache.delete(orgId);
  }

  private async fetchAdminRow(
    orgId: string,
  ): Promise<OrgAiProviderSettingsAdminRow | null> {
    const serviceSupabase = createSupabaseServiceClient();
    const { data, error } = await serviceSupabase
      .from('org_ai_provider_settings')
      .select(
        'provider, model, api_key_ciphertext, api_key_last_four, messaging_features_enabled, updated_at',
      )
      .eq('org_id', orgId)
      .maybeSingle<OrgAiProviderSettingsAdminRow>();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  private toAdminVm(
    orgId: string,
    row: OrgAiProviderSettingsAdminRow | null,
  ): OrgAiSettingsVM {
    if (!row) {
      return {
        orgId,
        provider: 'anthropic',
        model: null,
        hasApiKey: false,
        apiKeyLastFour: null,
        messagingFeaturesEnabled: false,
        updatedAt: null,
      };
    }
    return {
      orgId,
      provider: row.provider,
      model: row.model,
      hasApiKey: Boolean(row.api_key_ciphertext),
      apiKeyLastFour: row.api_key_last_four,
      messagingFeaturesEnabled: row.messaging_features_enabled,
      updatedAt: row.updated_at,
    };
  }

  /** Returns null when the org has no key configured or has the feature turned off — the two states that should behave identically to callers. */
  private async getRuntimeConfig(orgId: string): Promise<AiProviderConfig | null> {
    const cached = this.cache.get(orgId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.config;
    }

    const config = await this.loadRuntimeConfig(orgId);
    this.cache.set(orgId, { config, expiresAt: Date.now() + CACHE_TTL_MS });
    return config;
  }

  private async loadRuntimeConfig(orgId: string): Promise<AiProviderConfig | null> {
    const serviceSupabase = createSupabaseServiceClient();
    const { data, error } = await serviceSupabase
      .from('org_ai_provider_settings')
      .select('provider, model, api_key_ciphertext, messaging_features_enabled')
      .eq('org_id', orgId)
      .maybeSingle<OrgAiProviderSettingsRow>();

    if (error) {
      this.logger.warn('org_ai_settings.load_failed', { orgId, error: error.message });
      return null;
    }
    if (!data || !data.messaging_features_enabled || !data.api_key_ciphertext) {
      return null;
    }

    try {
      const apiKey = decryptSecret(data.api_key_ciphertext, requireEncryptionKey());
      return { provider: data.provider, apiKey, model: data.model };
    } catch (decryptError) {
      this.logger.error('org_ai_settings.decrypt_failed', {
        orgId,
        error: decryptError instanceof Error ? decryptError.message : decryptError,
      });
      return null;
    }
  }
}
