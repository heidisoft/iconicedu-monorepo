import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAdminOrgContext, createSupabaseServiceClient } = vi.hoisted(() => ({
  requireAdminOrgContext: vi.fn(),
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/admin/require-admin-org-context', () => ({
  requireAdminOrgContext,
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient,
}));

import { POST } from '@iconicedu/web/app/api/admin/tools/dispatch/route';

const originalEnv = {
  API_URL: process.env.API_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NODE_ENV: process.env.NODE_ENV,
  INTERNAL_ACTIVITY_WORKER_TOKEN_API: process.env.INTERNAL_ACTIVITY_WORKER_TOKEN_API,
  INTERNAL_ACTIVITY_PROJECTOR_TOKEN: process.env.INTERNAL_ACTIVITY_PROJECTOR_TOKEN,
};

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/tools/dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/tools/dispatch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    requireAdminOrgContext.mockResolvedValue({
      ok: true,
      orgId: 'org-1',
      actorProfileId: 'profile-1',
    });
    process.env.API_URL = 'http://127.0.0.1:3001/';
    process.env.NEXT_PUBLIC_API_URL = '';
    process.env.INTERNAL_ACTIVITY_WORKER_TOKEN_API = 'worker-token';
    process.env.INTERNAL_ACTIVITY_PROJECTOR_TOKEN = 'projector-token';
  });

  afterEach(() => {
    process.env.API_URL = originalEnv.API_URL;
    process.env.NEXT_PUBLIC_API_URL = originalEnv.NEXT_PUBLIC_API_URL;
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.INTERNAL_ACTIVITY_WORKER_TOKEN_API =
      originalEnv.INTERNAL_ACTIVITY_WORKER_TOKEN_API;
    process.env.INTERNAL_ACTIVITY_PROJECTOR_TOKEN =
      originalEnv.INTERNAL_ACTIVITY_PROJECTOR_TOKEN;
  });

  it('runs activity worker jobs through the API endpoint with cron-style defaults', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ claimed: 1, succeeded: 1 }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      request({
        orgId: 'org-1',
        kind: 'activity-worker-dispatch',
        limit: 5,
        leaseSeconds: 90,
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/internal/activity-worker/dispatch',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer worker-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          limit: 5,
          leaseSeconds: 90,
          leaseOwner: 'supabase-edge-cron',
        }),
      }),
    );
  });

  it('runs projector jobs with the same body shape as the edge function', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ processed: 2 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      request({
        orgId: 'org-1',
        kind: 'activity-projector-dispatch',
        limit: 2,
        leaseOwner: 'ignored',
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/internal/activity-feed/project',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer projector-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: 2 }),
      }),
    );
  });

  it('runs channel read-state repair through the same org scan and repair RPC', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: 3, error: null })
      .mockResolvedValueOnce({ data: 2, error: null });
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          is: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({
              data: [{ id: 'org-1' }, { id: 'org-2' }],
              error: null,
            }),
          })),
        })),
      })),
      rpc,
    };
    createSupabaseServiceClient.mockReturnValue(supabase);

    const response = await POST(
      request({ orgId: 'org-1', kind: 'channel-read-state-repair' }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({
      ok: true,
      orgCount: 2,
      repairedChannels: 5,
    });
    expect(rpc).toHaveBeenCalledWith('recompute_all_channel_unread_for_org', {
      p_org_id: 'org-1',
    });
    expect(rpc).toHaveBeenCalledWith('recompute_all_channel_unread_for_org', {
      p_org_id: 'org-2',
    });
  });
});
