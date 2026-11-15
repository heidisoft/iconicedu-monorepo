import Anthropic from '@anthropic-ai/sdk';
import { InternalServerErrorException } from '@nestjs/common';
import type { AiCompletionClient } from '@iconicedu/api/lib/ai/providers/types';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_TOKENS = 1024;

export function createAnthropicClient(
  apiKey: string,
  model?: string | null,
): AiCompletionClient {
  const client = new Anthropic({ apiKey, timeout: DEFAULT_TIMEOUT_MS, maxRetries: 1 });
  const resolvedModel = model?.trim() || DEFAULT_MODEL;

  return {
    async complete({ system, userContent, maxTokens }) {
      let response;
      try {
        response = await client.messages.create({
          model: resolvedModel,
          max_tokens: maxTokens ?? DEFAULT_MAX_TOKENS,
          system,
          messages: [{ role: 'user', content: userContent }],
        });
      } catch (error) {
        throw new InternalServerErrorException(
          error instanceof Error
            ? `AI assist request failed: ${error.message}`
            : 'AI assist request failed',
        );
      }

      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === 'text',
      );
      if (!textBlock?.text) {
        throw new InternalServerErrorException('AI assist returned an empty response');
      }
      if (response.stop_reason === 'max_tokens') {
        // The response was cut off mid-generation — returning it as a
        // successful rewrite would silently hand back truncated text (and,
        // for `refineDraft`, a fact-preservation check that never sees the
        // dropped tail can misreport `factsPreserved: true`).
        throw new InternalServerErrorException(
          'AI assist response was truncated — try a shorter draft or selection',
        );
      }
      return textBlock.text.trim();
    },
  };
}
