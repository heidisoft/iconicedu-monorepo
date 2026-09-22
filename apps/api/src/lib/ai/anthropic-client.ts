import Anthropic from '@anthropic-ai/sdk';
import {
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_TOKENS = 1024;

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new ServiceUnavailableException('AI assist is not configured');
  }
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey, timeout: DEFAULT_TIMEOUT_MS, maxRetries: 1 });
  }
  return cachedClient;
}

function resolveModel(): string {
  return process.env.ANTHROPIC_AI_ASSIST_MODEL?.trim() || DEFAULT_MODEL;
}

/**
 * A single, minimal entry point for calling Claude — every AI-assist
 * capability goes through here so the model, timeout, and error handling
 * stay consistent in one place. Callers own prompt construction; this
 * function only owns the transport.
 */
export async function completeWithClaude(input: {
  system: string;
  userContent: string;
  maxTokens?: number;
}): Promise<string> {
  const client = getClient();
  try {
    const response = await client.messages.create({
      model: resolveModel(),
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: input.system,
      messages: [{ role: 'user', content: input.userContent }],
    });
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );
    if (!textBlock?.text) {
      throw new InternalServerErrorException('AI assist returned an empty response');
    }
    return textBlock.text.trim();
  } catch (error) {
    if (error instanceof InternalServerErrorException) throw error;
    throw new InternalServerErrorException(
      error instanceof Error
        ? `AI assist request failed: ${error.message}`
        : 'AI assist request failed',
    );
  }
}
