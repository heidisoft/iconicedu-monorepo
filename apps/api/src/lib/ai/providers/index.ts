import { ServiceUnavailableException } from '@nestjs/common';
import type {
  AiCompletionClient,
  AiProviderConfig,
} from '@iconicedu/api/lib/ai/providers/types';
import { createAnthropicClient } from '@iconicedu/api/lib/ai/providers/anthropic-provider';
import { createOpenAiClient } from '@iconicedu/api/lib/ai/providers/openai-provider';

export type { AiCompletionClient, AiCompletionRequest, AiProviderConfig } from './types';

/** The one place a provider id resolves to an actual client — add a new provider by adding a case here. */
export function createAiCompletionClient(config: AiProviderConfig): AiCompletionClient {
  switch (config.provider) {
    case 'anthropic':
      return createAnthropicClient(config.apiKey, config.model);
    case 'openai':
      return createOpenAiClient(config.apiKey, config.model);
    default:
      throw new ServiceUnavailableException(
        `Unsupported AI provider: ${config.provider satisfies never}`,
      );
  }
}
