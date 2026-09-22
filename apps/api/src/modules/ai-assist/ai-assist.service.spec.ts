import { AiAssistService } from './ai-assist.service';
import { MessagesService } from '@iconicedu/api/modules/messages/messages.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { completeWithClaude } from '@iconicedu/api/lib/ai/anthropic-client';
import { evaluateApiBooleanFlag } from '@iconicedu/api/lib/flags/posthog-openfeature';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/ai/anthropic-client', () => ({
  completeWithClaude: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/flags/posthog-openfeature', () => ({
  apiFeatureFlagKeys: {
    enableAiRefine: 'enable-ai-refine',
    enableAiSuggestedReplies: 'enable-ai-suggested-replies',
  },
  evaluateApiBooleanFlag: jest.fn(),
}));

function makeChain(result: { data: unknown; error: null; count?: number }) {
  const chain: Record<string, unknown> = {};
  ['select', 'eq', 'is', 'gte', 'insert'].forEach((method) => {
    chain[method] = jest.fn(() => chain);
  });
  chain.maybeSingle = jest.fn(async () => result);
  (chain as { then: (...args: unknown[]) => Promise<unknown> }).then = (
    resolve,
    reject,
  ) => Promise.resolve(result).then(resolve as never, reject as never);
  return chain;
}

const ORG_ID = 'org-1';
const CHANNEL_ID = 'chan-1';
const PROFILE_ID = 'profile-1';

function makeMessagesServiceMock(profileKind: string) {
  return {
    resolveWritableProfile: jest.fn(async () => ({
      accountId: 'account-1',
      profile: { id: PROFILE_ID, kind: profileKind },
    })),
    getChannelMessages: jest.fn(async () => []),
  } as unknown as MessagesService;
}

function setUpSupabase(input: { membershipFound: boolean; usageCount?: number }) {
  const membershipChain = makeChain({
    data: input.membershipFound ? { id: 'member-1' } : null,
    error: null,
  });
  const usageCountChain = makeChain({
    data: null,
    error: null,
    count: input.usageCount ?? 0,
  });
  (usageCountChain as unknown as { then: (resolve: (v: unknown) => void) => void }).then =
    (resolve) => resolve({ data: null, error: null, count: input.usageCount ?? 0 });
  const usageInsertChain = makeChain({ data: null, error: null });

  let usageCallCount = 0;
  const from = jest.fn((table: string) => {
    if (table === 'channel_members') return membershipChain;
    if (table === 'ai_assist_usage') {
      usageCallCount += 1;
      return usageCallCount === 1 ? usageCountChain : usageInsertChain;
    }
    throw new Error(`unexpected table ${table}`);
  });
  jest.mocked(createSupabaseServiceClient).mockReturnValue({ from } as never);
  return { usageInsertChain };
}

describe('AiAssistService.refineDraft', () => {
  beforeEach(() => {
    jest.mocked(createSupabaseServiceClient).mockReset();
    jest.mocked(completeWithClaude).mockReset();
    jest.mocked(evaluateApiBooleanFlag).mockReset().mockResolvedValue(true);
  });

  it('rejects when the enable-ai-refine flag is off', async () => {
    setUpSupabase({ membershipFound: true });
    jest.mocked(evaluateApiBooleanFlag).mockResolvedValue(false);
    const service = new AiAssistService(makeMessagesServiceMock('guardian'));

    await expect(
      service.refineDraft('auth-user-1', 'token', {
        orgId: ORG_ID,
        channelId: CHANNEL_ID,
        profileId: PROFILE_ID,
        content: 'hello there',
        instruction: 'proofread',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(completeWithClaude).not.toHaveBeenCalled();
  });

  it('rejects a profile kind that is not eligible (e.g. child)', async () => {
    setUpSupabase({ membershipFound: true });
    const service = new AiAssistService(makeMessagesServiceMock('child'));

    await expect(
      service.refineDraft('auth-user-1', 'token', {
        orgId: ORG_ID,
        channelId: CHANNEL_ID,
        profileId: PROFILE_ID,
        content: 'hello there',
        instruction: 'proofread',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(completeWithClaude).not.toHaveBeenCalled();
  });

  it('rejects when the profile is not a member of the channel', async () => {
    setUpSupabase({ membershipFound: false });
    const service = new AiAssistService(makeMessagesServiceMock('guardian'));

    await expect(
      service.refineDraft('auth-user-1', 'token', {
        orgId: ORG_ID,
        channelId: CHANNEL_ID,
        profileId: PROFILE_ID,
        content: 'hello there',
        instruction: 'proofread',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(completeWithClaude).not.toHaveBeenCalled();
  });

  it('rejects empty content', async () => {
    setUpSupabase({ membershipFound: true });
    const service = new AiAssistService(makeMessagesServiceMock('guardian'));

    await expect(
      service.refineDraft('auth-user-1', 'token', {
        orgId: ORG_ID,
        channelId: CHANNEL_ID,
        profileId: PROFILE_ID,
        content: '   ',
        instruction: 'proofread',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects content over the size cap', async () => {
    setUpSupabase({ membershipFound: true });
    const service = new AiAssistService(makeMessagesServiceMock('guardian'));

    await expect(
      service.refineDraft('auth-user-1', 'token', {
        orgId: ORG_ID,
        channelId: CHANNEL_ID,
        profileId: PROFILE_ID,
        content: 'a'.repeat(5000),
        instruction: 'proofread',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires customInstruction for the custom instruction', async () => {
    setUpSupabase({ membershipFound: true });
    const service = new AiAssistService(makeMessagesServiceMock('guardian'));

    await expect(
      service.refineDraft('auth-user-1', 'token', {
        orgId: ORG_ID,
        channelId: CHANNEL_ID,
        profileId: PROFILE_ID,
        content: 'hello',
        instruction: 'custom',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires targetLanguage for the translate instruction', async () => {
    setUpSupabase({ membershipFound: true });
    const service = new AiAssistService(makeMessagesServiceMock('guardian'));

    await expect(
      service.refineDraft('auth-user-1', 'token', {
        orgId: ORG_ID,
        channelId: CHANNEL_ID,
        profileId: PROFILE_ID,
        content: 'hello',
        instruction: 'translate',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects once the profile has hit today's rate limit", async () => {
    setUpSupabase({ membershipFound: true, usageCount: 30 });
    const service = new AiAssistService(makeMessagesServiceMock('guardian'));

    await expect(
      service.refineDraft('auth-user-1', 'token', {
        orgId: ORG_ID,
        channelId: CHANNEL_ID,
        profileId: PROFILE_ID,
        content: 'hello',
        instruction: 'proofread',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(completeWithClaude).not.toHaveBeenCalled();
  });

  it('refines only the selected span and flags a dropped fact', async () => {
    setUpSupabase({ membershipFound: true, usageCount: 0 });
    jest.mocked(completeWithClaude).mockResolvedValue('Thanks for the update');
    const service = new AiAssistService(makeMessagesServiceMock('guardian'));

    const result = await service.refineDraft('auth-user-1', 'token', {
      orgId: ORG_ID,
      channelId: CHANNEL_ID,
      profileId: PROFILE_ID,
      content: 'Thanks @Jane Smith for the update',
      selectionStart: 0,
      selectionEnd: 34,
      instruction: 'proofread',
    });

    expect(result.factsPreserved).toBe(false);
    expect(result.flaggedNotes?.[0]).toMatch(/@Jane Smith/);
  });

  it('succeeds and reports facts preserved when nothing important was dropped', async () => {
    setUpSupabase({ membershipFound: true, usageCount: 0 });
    jest.mocked(completeWithClaude).mockResolvedValue('hi there!');
    const service = new AiAssistService(makeMessagesServiceMock('educator'));

    const result = await service.refineDraft('auth-user-1', 'token', {
      orgId: ORG_ID,
      channelId: CHANNEL_ID,
      profileId: PROFILE_ID,
      content: 'hello there',
      instruction: 'proofread',
    });

    expect(result).toEqual({
      refinedText: 'hi there!',
      factsPreserved: true,
      flaggedNotes: undefined,
    });
  });
});

describe('AiAssistService.suggestReplies', () => {
  beforeEach(() => {
    jest.mocked(createSupabaseServiceClient).mockReset();
    jest.mocked(completeWithClaude).mockReset();
    jest.mocked(evaluateApiBooleanFlag).mockReset().mockResolvedValue(true);
  });

  it('rejects when the enable-ai-suggested-replies flag is off', async () => {
    setUpSupabase({ membershipFound: true });
    jest.mocked(evaluateApiBooleanFlag).mockResolvedValue(false);
    const service = new AiAssistService(makeMessagesServiceMock('guardian'));

    await expect(
      service.suggestReplies('auth-user-1', 'token', {
        orgId: ORG_ID,
        channelId: CHANNEL_ID,
        profileId: PROFILE_ID,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an ineligible profile kind', async () => {
    setUpSupabase({ membershipFound: true });
    const service = new AiAssistService(makeMessagesServiceMock('child'));

    await expect(
      service.suggestReplies('auth-user-1', 'token', {
        orgId: ORG_ID,
        channelId: CHANNEL_ID,
        profileId: PROFILE_ID,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns an empty suggestion list when the channel has no messages', async () => {
    setUpSupabase({ membershipFound: true });
    const service = new AiAssistService(makeMessagesServiceMock('staff'));

    const result = await service.suggestReplies('auth-user-1', 'token', {
      orgId: ORG_ID,
      channelId: CHANNEL_ID,
      profileId: PROFILE_ID,
    });
    expect(result).toEqual({ suggestions: [] });
    expect(completeWithClaude).not.toHaveBeenCalled();
  });

  it('parses a JSON array response, ignoring a stray code fence', async () => {
    setUpSupabase({ membershipFound: true });
    jest
      .mocked(completeWithClaude)
      .mockResolvedValue('```json\n["Sounds good!", "Can we confirm the time?"]\n```');
    const messagesService = makeMessagesServiceMock('guardian');
    (messagesService.getChannelMessages as jest.Mock).mockResolvedValue([
      {
        ids: { id: 'm1' },
        core: { type: 'text', sender: { profile: { displayName: 'Alice' } } },
        content: { text: 'When is the trip?' },
      },
    ]);
    const service = new AiAssistService(messagesService);

    const result = await service.suggestReplies('auth-user-1', 'token', {
      orgId: ORG_ID,
      channelId: CHANNEL_ID,
      profileId: PROFILE_ID,
    });
    expect(result.suggestions).toEqual(['Sounds good!', 'Can we confirm the time?']);
  });

  it('returns no suggestions when the model output is not valid JSON', async () => {
    setUpSupabase({ membershipFound: true });
    jest.mocked(completeWithClaude).mockResolvedValue('Sure, happy to help!');
    const messagesService = makeMessagesServiceMock('guardian');
    (messagesService.getChannelMessages as jest.Mock).mockResolvedValue([
      {
        ids: { id: 'm1' },
        core: { type: 'text', sender: { profile: { displayName: 'Alice' } } },
        content: { text: 'hi' },
      },
    ]);
    const service = new AiAssistService(messagesService);

    const result = await service.suggestReplies('auth-user-1', 'token', {
      orgId: ORG_ID,
      channelId: CHANNEL_ID,
      profileId: PROFILE_ID,
    });
    expect(result.suggestions).toEqual([]);
  });
});
