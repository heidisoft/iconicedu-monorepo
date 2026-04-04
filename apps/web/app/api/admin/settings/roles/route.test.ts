import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DELETE, GET, POST } from '@iconicedu/web/app/api/admin/settings/roles/route';

const requireAdminOrgContext = vi.fn();
const createSupabaseServiceClient = vi.fn();
const listUserRolesByOrgId = vi.fn();
const upsertUserRole = vi.fn();
const softDeleteUserRole = vi.fn();

vi.mock('@iconicedu/web/lib/admin/require-admin-org-context', () => ({
  requireAdminOrgContext: (...args: unknown[]) => requireAdminOrgContext(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: (...args: unknown[]) =>
    createSupabaseServiceClient(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/roles.query', () => ({
  listUserRolesByOrgId: (...args: unknown[]) => listUserRolesByOrgId(...args),
  upsertUserRole: (...args: unknown[]) => upsertUserRole(...args),
  softDeleteUserRole: (...args: unknown[]) => softDeleteUserRole(...args),
}));

function createServiceClientMock() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'accounts') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                returns: vi.fn(async () => ({
                  data: [
                    {
                      id: 'account-1',
                      email: 'iconicedudev+parent@gmail.com',
                      created_at: '2026-03-10T00:00:00.000Z',
                    },
                  ],
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                returns: vi.fn(async () => ({
                  data: [
                    {
                      id: 'profile-1',
                      account_id: 'account-1',
                      kind: 'guardian',
                      display_name: 'Taylor Parent',
                      first_name: 'Taylor',
                      last_name: 'Parent',
                      created_at: '2026-03-10T00:00:00.000Z',
                    },
                  ],
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe('admin settings roles route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminOrgContext.mockResolvedValue({
      ok: true,
      orgId: 'org-1',
      actorProfileId: 'profile-admin-1',
    });
    createSupabaseServiceClient.mockReturnValue(createServiceClientMock());
    listUserRolesByOrgId.mockResolvedValue({
      data: [
        {
          id: 'role-1',
          org_id: 'org-1',
          account_id: 'account-1',
          role_key: 'guardian',
          assigned_by: 'profile-admin-1',
          assigned_at: '2026-03-10T00:00:00.000Z',
        },
      ],
      error: null,
    });
    upsertUserRole.mockResolvedValue({ data: {}, error: null });
    softDeleteUserRole.mockResolvedValue({
      data: { id: 'role-2' },
      error: null,
    });
  });

  it('returns 400 for GET without orgId', async () => {
    const response = await GET(new Request('http://localhost/api/admin/settings/roles'));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: 'orgId is required',
    });
  });

  it('returns 403 for GET when admin auth fails', async () => {
    requireAdminOrgContext.mockResolvedValueOnce({
      ok: false,
      status: 403,
      message: 'Forbidden',
    });
    const response = await GET(
      new Request('http://localhost/api/admin/settings/roles?orgId=org-1'),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ success: false, message: 'Forbidden' });
  });

  it('returns users and roles on GET', async () => {
    const response = await GET(
      new Request('http://localhost/api/admin/settings/roles?orgId=org-1'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.users).toEqual([
      {
        accountId: 'account-1',
        email: 'iconicedudev+parent@gmail.com',
        displayName: 'Taylor Parent',
        profileKind: 'guardian',
        roles: ['guardian'],
      },
    ]);
  });

  it('assigns role via POST', async () => {
    const response = await POST(
      new Request('http://localhost/api/admin/settings/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: 'org-1',
          accountId: 'account-1',
          roleKey: 'educator',
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(upsertUserRole).toHaveBeenCalledWith(expect.anything(), {
      orgId: 'org-1',
      accountId: 'account-1',
      roleKey: 'educator',
      assignedBy: 'profile-admin-1',
    });
  });

  it('blocks removing owner/admin roles', async () => {
    const response = await DELETE(
      new Request('http://localhost/api/admin/settings/roles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: 'org-1',
          accountId: 'account-1',
          roleKey: 'admin',
        }),
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Removing owner or admin roles is not allowed.',
    });
    expect(softDeleteUserRole).not.toHaveBeenCalled();
  });

  it('removes non-protected role via DELETE', async () => {
    const response = await DELETE(
      new Request('http://localhost/api/admin/settings/roles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: 'org-1',
          accountId: 'account-1',
          roleKey: 'guardian',
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(softDeleteUserRole).toHaveBeenCalledWith(expect.anything(), {
      orgId: 'org-1',
      accountId: 'account-1',
      roleKey: 'guardian',
      deletedBy: 'profile-admin-1',
    });
  });
});
