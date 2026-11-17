import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createSupabaseServerClientMock,
  requireAdminAuthContextMock,
  publishActivityEventMock,
  apiPostMock,
  getLearningSpaceEditContextMock,
} = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn(),
  requireAdminAuthContextMock: vi.fn(),
  publishActivityEventMock: vi.fn(),
  apiPostMock: vi.fn(),
  getLearningSpaceEditContextMock: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

vi.mock('@iconicedu/web/lib/admin/_auth-context', () => ({
  requireAdminAuthContext: requireAdminAuthContextMock,
}));

vi.mock('@iconicedu/web/lib/activity-feed/publisher/activity-publisher', () => ({
  publishActivityEvent: publishActivityEventMock,
}));

vi.mock('@iconicedu/web/lib/api/http-client', () => ({
  createApiClient: vi.fn(() => ({ post: apiPostMock })),
}));

vi.mock('@iconicedu/web/lib/api/schedules', () => ({
  getLearningSpaceEditContext: getLearningSpaceEditContextMock,
}));

import type { LearningSpaceCreatePayload } from '@iconicedu/shared-types';
import { updateLearningSpaceFromPayload } from '@iconicedu/web/lib/admin/learning-space-update';

const payload: LearningSpaceCreatePayload = {
  basics: {
    title: 'Math Foundations',
    kind: 'small_group',
    iconKey: 'book-open',
    subject: 'Math',
    description: 'Weekly math fundamentals',
  },
  settings: { themeKey: 'teal', uiDefaults: null },
  liveSession: null,
  participants: [],
  schedules: [],
};

function selectChain(data: unknown) {
  const chain = {
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  };
  return { select: vi.fn(() => chain) };
}

function buildServerClient() {
  const mutations = {
    insert: vi.fn(async () => ({ error: null })),
    upsert: vi.fn(async () => ({ error: null })),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const client = {
    from: vi.fn((table: string) => {
      if (table === 'learning_spaces') {
        return { ...selectChain({ id: 'space-1', org_id: 'org-1' }), ...mutations };
      }
      if (table === 'learning_space_channels') {
        return { ...selectChain({ channel_id: 'channel-1' }), ...mutations };
      }
      return mutations;
    }),
  };
  return { client, mutations };
}

describe('updateLearningSpaceFromPayload edit-context read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminAuthContextMock.mockResolvedValue({
      orgId: 'org-1',
      profileId: 'profile-actor-1',
    });
  });

  it('reads the edit snapshot through apps/api, scoped to the org, space, and primary channel', async () => {
    const { client } = buildServerClient();
    createSupabaseServerClientMock.mockResolvedValue(client);
    getLearningSpaceEditContextMock.mockRejectedValue(new Error('stop after read'));

    await expect(updateLearningSpaceFromPayload('space-1', payload)).rejects.toThrow(
      'stop after read',
    );

    expect(getLearningSpaceEditContextMock).toHaveBeenCalledTimes(1);
    // The session (RLS-scoped) client is forwarded so apps/api receives the
    // caller's bearer token rather than any elevated credential.
    expect(getLearningSpaceEditContextMock).toHaveBeenCalledWith(client, {
      orgId: 'org-1',
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
    });
  });

  it('uses the caller-provided actor context org instead of re-resolving admin auth', async () => {
    const { client } = buildServerClient();
    createSupabaseServerClientMock.mockResolvedValue(client);
    getLearningSpaceEditContextMock.mockRejectedValue(new Error('stop after read'));

    await expect(
      updateLearningSpaceFromPayload('space-1', payload, {
        orgId: 'org-2',
        actorProfileId: 'profile-actor-2',
      }),
    ).rejects.toThrow('stop after read');

    expect(requireAdminAuthContextMock).not.toHaveBeenCalled();
    expect(getLearningSpaceEditContextMock).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ orgId: 'org-2' }),
    );
  });

  it('aborts the save without writing anything when the API snapshot read fails', async () => {
    const { client, mutations } = buildServerClient();
    createSupabaseServerClientMock.mockResolvedValue(client);
    getLearningSpaceEditContextMock.mockRejectedValue(new Error('API 403: Forbidden'));

    await expect(updateLearningSpaceFromPayload('space-1', payload)).rejects.toThrow(
      'API 403: Forbidden',
    );

    expect(mutations.insert).not.toHaveBeenCalled();
    expect(mutations.upsert).not.toHaveBeenCalled();
    expect(mutations.update).not.toHaveBeenCalled();
    expect(mutations.delete).not.toHaveBeenCalled();
    expect(apiPostMock).not.toHaveBeenCalled();
    expect(publishActivityEventMock).not.toHaveBeenCalled();
  });

  it('does not reach the API when the primary channel is missing', async () => {
    const client = {
      from: vi.fn((table: string) =>
        table === 'learning_spaces'
          ? selectChain({ id: 'space-1', org_id: 'org-1' })
          : selectChain(null),
      ),
    };
    createSupabaseServerClientMock.mockResolvedValue(client);

    await expect(updateLearningSpaceFromPayload('space-1', payload)).rejects.toThrow(
      'Primary channel not found',
    );
    expect(getLearningSpaceEditContextMock).not.toHaveBeenCalled();
  });

  // Regression guard for #248: the admin editor must not construct a
  // service-role (RLS-bypassing) Supabase client in apps/web.
  it('does not import the service-role Supabase client', () => {
    const source = readFileSync(join(__dirname, 'learning-space-update.ts'), 'utf8');
    expect(source).not.toMatch(/lib\/supabase\/service/);
    expect(source).not.toMatch(/createSupabaseServiceClient/);
  });
});
