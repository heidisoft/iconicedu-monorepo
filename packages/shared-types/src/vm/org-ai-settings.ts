import type { ISODateTime, UUID } from '@iconicedu/shared-types/shared/shared';

export type AiProviderId = 'anthropic' | 'openai';

/**
 * Masked view of an org's AI provider configuration — never carries the
 * decrypted API key. `apiKeyLastFour` is null when no key has been saved
 * yet. See apps/api's org-ai-settings service for the runtime (decrypted)
 * counterpart used when actually calling the provider.
 */
export interface OrgAiSettingsVM {
  orgId: UUID;
  provider: AiProviderId;
  model: string | null;
  hasApiKey: boolean;
  apiKeyLastFour: string | null;
  messagingFeaturesEnabled: boolean;
  updatedAt: ISODateTime | null;
}
