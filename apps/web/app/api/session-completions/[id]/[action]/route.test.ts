import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  createSupabaseServerClient: vi.fn(async () => ({ auth: {} })),
}));

vi.mock('@iconicedu/web/lib/api/http-client', () => ({
  createApiClient: vi.fn(() => ({ post: mocks.post })),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

describe('POST /api/session-completions/[id]/[action]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockResolvedValue({ success: true });
  });

  it('proxies an id-addressed action through the authenticated API client', async () => {
    const response = await POST(
      new Request('https://app.test/api/session-completions/completion-1/confirm', {
        method: 'POST',
        body: JSON.stringify({ orgId: 'org-1' }),
      }),
      { params: Promise.resolve({ id: 'completion-1', action: 'confirm' }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.post).toHaveBeenCalledWith('/session-completions/completion-1/confirm', {
      orgId: 'org-1',
    });
  });

  it('rejects unsupported actions before contacting the API', async () => {
    const response = await POST(
      new Request('https://app.test/api/session-completions/completion-1/delete', {
        method: 'POST',
        body: JSON.stringify({ orgId: 'org-1' }),
      }),
      { params: Promise.resolve({ id: 'completion-1', action: 'delete' }) },
    );

    expect(response.status).toBe(404);
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
