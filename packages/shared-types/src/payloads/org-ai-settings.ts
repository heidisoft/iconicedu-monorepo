import type { UUID } from '@iconicedu/shared-types/shared/shared';
import type { AiProviderId } from '@iconicedu/shared-types/vm/org-ai-settings';

export type UpdateOrgAiSettingsInput = {
  orgId: UUID;
  provider: AiProviderId;
  model?: string | null;
  /** Only sent when the admin is setting or rotating the key — omit to keep the existing stored key. */
  apiKey?: string;
  messagingFeaturesEnabled: boolean;
};
