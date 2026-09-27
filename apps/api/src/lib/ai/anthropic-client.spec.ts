const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

import { completeWithClaude } from './anthropic-client';

describe('completeWithClaude', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: 'test-key' };
    mockCreate.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects a response that was cut off by the token limit instead of returning truncated text', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'partial rewrite that got cut off mid' }],
      stop_reason: 'max_tokens',
    });

    await expect(
      completeWithClaude({ system: 'You rewrite drafts.', userContent: 'hello' }),
    ).rejects.toThrow(/truncated/i);
  });

  it('returns the trimmed text when generation completed normally', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '  hello there!  ' }],
      stop_reason: 'end_turn',
    });

    const result = await completeWithClaude({
      system: 'You rewrite drafts.',
      userContent: 'hello',
    });

    expect(result).toBe('hello there!');
  });
});
