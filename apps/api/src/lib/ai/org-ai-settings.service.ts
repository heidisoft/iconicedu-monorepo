import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { decryptSecret } from '@iconicedu/api/lib/ai/secret-cipher';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import {
  createAiCompletionClient,
  type AiCompletionRequest,
  type AiProviderConfig,
} from '@iconicedu/api/lib/ai/providers';

const CACHE_TTL_MS = 30_000;

type OrgAiProviderSettingsRow = {
  provider: AiProviderConfig['provider'];
  model: string | null;
  api_key_ciphertext: string | null;
  messaging_features_enabled: boolean;
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
