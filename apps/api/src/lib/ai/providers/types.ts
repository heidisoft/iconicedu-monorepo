import type { AiProviderId } from '@iconicedu/shared-types';

export type { AiProviderId };

export interface AiCompletionRequest {
  system: string;
  userContent: string;
  maxTokens?: number;
}

export interface AiCompletionClient {
  complete(request: AiCompletionRequest): Promise<string>;
}

export interface AiProviderConfig {
  provider: AiProviderId;
  apiKey: string;
  model?: string | null;
}
