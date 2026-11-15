import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/ai-assist/refine/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const apiPost = vi.fn();
const requireEffectiveActorContext = vi.fn();
const enableAiRefineRun = vi.fn();
const APP_URL = resolveAppUrl();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({})),
}));

vi.mock('@iconicedu/web/lib/api/http-client', () => ({
  createApiClient: vi.fn(() => ({ post: apiPost })),
}));

vi.mock('@iconicedu/web/lib/family-view/actor-context', () => ({
  requireEffectiveActorContext: (...args: unknown[]) =>
    requireEffectiveActorContext(...args),
}));

vi.mock('@iconicedu/web/flags', () => ({
  enableAiRefine: { run: (...args: unknown[]) => enableAiRefineRun(...args) },
}));

describe('POST /api/ai-assist/refine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireEffectiveActorContext.mockResolvedValue({
      account: { id: 'account-1', org_id: 'org-1' },
      profile: { id: 'profile-1' },
    });
    enableAiRefineRun.mockResolvedValue(true);
    apiPost.mockResolvedValue({ refinedText: 'Hi there!', factsPreserved: true });
  });

  it('returns 403 when the flag is disabled', async () => {
    enableAiRefineRun.mockResolvedValue(false);

    const response = await POST(
      new Request(`${APP_URL}/api/ai-assist/refine`, {
        method: 'POST',
        body: JSON.stringify({
          channelId: 'channel-1',
          content: 'hi there',
          instruction: 'proofread',
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('returns 400 when content is missing', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/ai-assist/refine`, {
        method: 'POST',
        body: JSON.stringify({ channelId: 'channel-1', instruction: 'proofread' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('proxies a refine request to the API with the resolved actor context', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/ai-assist/refine`, {
        method: 'POST',
        body: JSON.stringify({
          channelId: 'channel-1',
          content: 'hi there',
          instruction: 'proofread',
        }),
      }),
    );

    expect(apiPost).toHaveBeenCalledWith('/ai-assist/refine', {
      orgId: 'org-1',
      channelId: 'channel-1',
      profileId: 'profile-1',
      content: 'hi there',
      selectionStart: undefined,
      selectionEnd: undefined,
      instruction: 'proofread',
      customInstruction: undefined,
      targetLanguage: undefined,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      refinedText: 'Hi there!',
      factsPreserved: true,
    });
  });

  it('maps a rate-limit error from the API to a 403 response', async () => {
    apiPost.mockRejectedValueOnce(
      new Error(
        "You've reached today's AI assist limit for this feature. Please try again tomorrow.",
      ),
    );

    const response = await POST(
      new Request(`${APP_URL}/api/ai-assist/refine`, {
        method: 'POST',
        body: JSON.stringify({
          channelId: 'channel-1',
          content: 'hi there',
          instruction: 'proofread',
        }),
      }),
    );

    expect(response.status).toBe(403);
  });

  it('maps an unexpected API error to a 500 response', async () => {
    apiPost.mockRejectedValueOnce(new Error('Something went wrong'));

    const response = await POST(
      new Request(`${APP_URL}/api/ai-assist/refine`, {
        method: 'POST',
        body: JSON.stringify({
          channelId: 'channel-1',
          content: 'hi there',
          instruction: 'proofread',
        }),
      }),
    );

    expect(response.status).toBe(500);
  });
});
