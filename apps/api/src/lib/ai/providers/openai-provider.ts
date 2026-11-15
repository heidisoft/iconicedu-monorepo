import OpenAI from 'openai';
import { InternalServerErrorException } from '@nestjs/common';
import type { AiCompletionClient } from '@iconicedu/api/lib/ai/providers/types';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_TOKENS = 1024;

export function createOpenAiClient(
  apiKey: string,
  model?: string | null,
): AiCompletionClient {
  const client = new OpenAI({ apiKey, timeout: DEFAULT_TIMEOUT_MS, maxRetries: 1 });
  const resolvedModel = model?.trim() || DEFAULT_MODEL;

  return {
    async complete({ system, userContent, maxTokens }) {
      let response;
      try {
        response = await client.chat.completions.create({
          model: resolvedModel,
          max_tokens: maxTokens ?? DEFAULT_MAX_TOKENS,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userContent },
          ],
        });
      } catch (error) {
        throw new InternalServerErrorException(
          error instanceof Error
            ? `AI assist request failed: ${error.message}`
            : 'AI assist request failed',
        );
      }

      const choice = response.choices[0];
      const text = choice?.message?.content?.trim();
      if (!text) {
        throw new InternalServerErrorException('AI assist returned an empty response');
      }
      if (choice.finish_reason === 'length') {
        throw new InternalServerErrorException(
          'AI assist response was truncated — try a shorter draft or selection',
        );
      }
      return text;
    },
  };
}
