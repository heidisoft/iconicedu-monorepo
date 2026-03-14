import { describe, expect, it, vi, beforeEach } from 'vitest';

import { POST } from './route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const APP_URL = resolveAppUrl();

const createSupabaseServerClientMock = vi.fn();
const requireAuthedUserMock = vi.fn();
const buildOrgBySlugMock = vi.fn();
const getAccountByAuthUserIdMock = vi.fn();
const getProfileByAccountIdMock = vi.fn();
const buildUserProfileByIdMock = vi.fn();
const getProfilesByIdsMock = vi.fn();
const getProfilesByKindMock = vi.fn();
const createPrivateClassRequestChannelMock = vi.fn();
const createSupabaseServiceClientMock = vi.fn();
const sendTextMessageActionMock = vi.fn();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: () => createSupabaseServerClientMock(),
}));
vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: () => createSupabaseServiceClientMock(),
}));
vi.mock('@iconicedu/web/app/actions/messages', () => ({
  sendTextMessageAction: (...args: unknown[]) => sendTextMessageActionMock(...args),
}));

vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser: (...args: unknown[]) => requireAuthedUserMock(...args),
}));

vi.mock('@iconicedu/web/lib/org/builders/org.builder', () => ({
  buildOrgBySlug: (...args: unknown[]) => buildOrgBySlugMock(...args),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: (...args: unknown[]) => getAccountByAuthUserIdMock(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileByAccountId: (...args: unknown[]) => getProfileByAccountIdMock(...args),
  getProfilesByIds: (...args: unknown[]) => getProfilesByIdsMock(...args),
  getProfilesByKind: (...args: unknown[]) => getProfilesByKindMock(...args),
}));

vi.mock('@iconicedu/web/lib/profile/builders/user-profile.builder', () => ({
  buildUserProfileById: (...args: unknown[]) => buildUserProfileByIdMock(...args),
}));

vi.mock('@iconicedu/web/lib/dashboard/class-request', async () => {
  const actual = await vi.importActual<
    typeof import('@iconicedu/web/lib/dashboard/class-request')
  >('@iconicedu/web/lib/dashboard/class-request');

  return {
    ...actual,
    createPrivateClassRequestChannel: (...args: unknown[]) =>
      createPrivateClassRequestChannelMock(...args),
  };
});

function createMockSupabase() {
  return {
    from: (table: string) => {
      if (table === 'messages') {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: 'message-1' }, error: null }),
            }),
          }),
        };
      }

      if (table === 'message_text') {
        return {
          insert: async () => ({ error: null }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe('POST /api/dashboard/class-requests', () => {
  beforeEach(() => {
    createSupabaseServerClientMock.mockReset();
    requireAuthedUserMock.mockReset();
    buildOrgBySlugMock.mockReset();
    getAccountByAuthUserIdMock.mockReset();
    getProfileByAccountIdMock.mockReset();
    buildUserProfileByIdMock.mockReset();
    getProfilesByIdsMock.mockReset();
    getProfilesByKindMock.mockReset();
    createPrivateClassRequestChannelMock.mockReset();
    createSupabaseServiceClientMock.mockReset();
    sendTextMessageActionMock.mockReset();

    createSupabaseServerClientMock.mockResolvedValue(createMockSupabase());
    createSupabaseServiceClientMock.mockReturnValue(createMockSupabase());
    sendTextMessageActionMock.mockResolvedValue({
      ids: { id: 'message-1', orgId: 'org-1' },
    });
    requireAuthedUserMock.mockResolvedValue({ id: 'auth-1' });
    buildOrgBySlugMock.mockResolvedValue({ id: 'org-1' });
    getAccountByAuthUserIdMock.mockResolvedValue({
      data: { id: 'account-1', org_id: 'org-1' },
    });
    getProfileByAccountIdMock.mockResolvedValue({
      data: {
        id: 'guardian-1',
        org_id: 'org-1',
        kind: 'guardian',
        display_name: 'Riley Morgan',
      },
    });
    buildUserProfileByIdMock.mockResolvedValue({
      kind: 'guardian',
      children: {
        items: [
          { ids: { id: 'child-1' }, profile: { displayName: 'Maya Morgan' } },
          { ids: { id: 'child-2' }, profile: { displayName: 'Tevin Morgan' } },
        ],
      },
    });
    getProfilesByIdsMock.mockResolvedValue({
      data: [
        { id: 'child-1', display_name: 'Maya Morgan' },
        { id: 'child-2', display_name: 'Tevin Morgan' },
      ],
    });
    getProfilesByKindMock.mockResolvedValue({
      data: [{ id: 'staff-1' }],
    });
    createPrivateClassRequestChannelMock.mockResolvedValue({ channelId: 'channel-1' });
  });

  it('returns 400 for invalid payload', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/dashboard/class-requests`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Invalid request payload.',
    });
  });

  it('returns 403 when caller is not parent or student', async () => {
    getProfileByAccountIdMock.mockResolvedValueOnce({
      data: {
        id: 'staff-2',
        org_id: 'org-1',
        kind: 'staff',
        display_name: 'Staff Member',
      },
    });

    const response = await POST(
      new Request(`${APP_URL}/api/dashboard/class-requests`, {
        method: 'POST',
        body: JSON.stringify({
          orgSlug: 'iconic-academy',
          studentProfileIds: ['child-1'],
          subjects: ['Math'],
          learningGoals: 'Build stronger algebra fundamentals',
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Only parents and students can submit requests.',
    });
  });

  it('creates channel and first message for valid parent request', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/dashboard/class-requests`, {
        method: 'POST',
        body: JSON.stringify({
          orgSlug: 'iconic-academy',
          studentProfileIds: ['child-1', 'child-2'],
          subjects: ['Math', 'Other'],
          otherSubject: 'Robotics',
          learningGoals: 'Fractions and problem solving',
          specialRequirements: 'Visual examples preferred',
        }),
      }),
    );

    expect(createPrivateClassRequestChannelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        topic: expect.stringContaining('Class Request'),
        requesterProfile: expect.objectContaining({ id: 'guardian-1' }),
      }),
    );
    expect(sendTextMessageActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        channelId: 'channel-1',
        senderProfileId: 'guardian-1',
        content: expect.stringContaining('Class Request'),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      channelId: 'channel-1',
    });
  });

  it('allows empty learning goals', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/dashboard/class-requests`, {
        method: 'POST',
        body: JSON.stringify({
          orgSlug: 'iconic-academy',
          studentProfileIds: ['child-1'],
          subjects: ['Math'],
          learningGoals: '',
          specialRequirements: 'Needs visual examples',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      channelId: 'channel-1',
    });
  });
});
