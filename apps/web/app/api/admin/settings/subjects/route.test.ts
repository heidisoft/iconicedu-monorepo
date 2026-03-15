import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET, PATCH, POST } from '@iconicedu/web/app/api/admin/settings/subjects/route';

const requireAdminOrgContextMock = vi.fn();
const createSupabaseServiceClientMock = vi.fn();
const listOrgSubjectCatalogMock = vi.fn();

vi.mock('@iconicedu/web/lib/admin/require-admin-org-context', () => ({
  requireAdminOrgContext: (...args: unknown[]) => requireAdminOrgContextMock(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: (...args: unknown[]) =>
    createSupabaseServiceClientMock(...args),
}));

vi.mock('@iconicedu/web/lib/subjects/queries/org-subject-catalog.query', () => ({
  listOrgSubjectCatalog: (...args: unknown[]) => listOrgSubjectCatalogMock(...args),
}));

function createServiceSupabaseMock() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'learning_spaces') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                returns: vi.fn(async () => ({
                  data: [{ subject: 'Math' }, { subject: 'Math' }],
                  error: null,
                })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(async () => ({ error: null })),
              })),
            })),
          })),
        };
      }

      if (table === 'educator_profile_subjects') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                returns: vi.fn(async () => ({
                  data: [{ subject: 'Science' }],
                  error: null,
                })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(async () => ({ error: null })),
              })),
            })),
          })),
        };
      }

      if (table === 'org_subject_catalog') {
        return {
          select: vi.fn((columns?: string) => {
            if (columns === 'id, sort_order, is_active') {
              return {
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    is: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: null,
                        error: null,
                      })),
                    })),
                  })),
                })),
              };
            }

            if (columns === 'id, subject, subject_key, is_active') {
              return {
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    is: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: {
                          id: 'subject-1',
                          subject: 'Math',
                          subject_key: 'math',
                          is_active: true,
                        },
                        error: null,
                      })),
                    })),
                  })),
                })),
              };
            }

            if (columns === 'id') {
              return {
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    is: vi.fn(() => ({
                      neq: vi.fn(() => ({
                        maybeSingle: vi.fn(async () => ({
                          data: null,
                          error: null,
                        })),
                      })),
                    })),
                  })),
                })),
              };
            }

            if (columns === 'sort_order') {
              return {
                eq: vi.fn(() => ({
                  is: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(() => ({
                        returns: vi.fn(async () => ({
                          data: [{ sort_order: 20 }],
                          error: null,
                        })),
                      })),
                    })),
                  })),
                })),
              };
            }

            throw new Error(`Unexpected select columns: ${columns}`);
          }),
          insert: vi.fn(async () => ({ error: null })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(async () => ({ error: null })),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe('admin subject catalog route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminOrgContextMock.mockResolvedValue({
      ok: true,
      orgId: 'org-1',
      actorProfileId: 'profile-admin-1',
    });
    createSupabaseServiceClientMock.mockReturnValue(createServiceSupabaseMock());
    listOrgSubjectCatalogMock.mockResolvedValue({
      data: [
        {
          id: 'subject-1',
          org_id: 'org-1',
          subject: 'Math',
          subject_key: 'math',
          is_active: true,
          sort_order: 10,
          created_at: '2026-03-15T12:00:00.000Z',
          updated_at: '2026-03-15T12:00:00.000Z',
        },
        {
          id: 'subject-2',
          org_id: 'org-1',
          subject: 'Science',
          subject_key: 'science',
          is_active: false,
          sort_order: 20,
          created_at: '2026-03-15T12:00:00.000Z',
          updated_at: '2026-03-15T12:00:00.000Z',
        },
      ],
      error: null,
    });
  });

  it('GET returns the catalog snapshot with usage counts', async () => {
    const response = await GET(
      new Request('http://localhost/api/admin/settings/subjects?orgId=org-1'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subject: 'Math',
          learningSpaceCount: 2,
          educatorProfileCount: 0,
          usageCount: 2,
        }),
        expect.objectContaining({
          subject: 'Science',
          learningSpaceCount: 0,
          educatorProfileCount: 1,
          usageCount: 1,
        }),
      ]),
    );
  });

  it('POST creates a new subject', async () => {
    const response = await POST(
      new Request('http://localhost/api/admin/settings/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: 'org-1', subject: 'Robotics' }),
      }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
  });

  it('PATCH toggles subject active state', async () => {
    const response = await PATCH(
      new Request('http://localhost/api/admin/settings/subjects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: 'org-1',
          subjectId: 'subject-2',
          isActive: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
  });

  it('PATCH renames a subject', async () => {
    const response = await PATCH(
      new Request('http://localhost/api/admin/settings/subjects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: 'org-1',
          subjectId: 'subject-1',
          subject: 'Mathematics',
          subjectKey: 'core-math',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
  });

  it('POST accepts a machine-name key override', async () => {
    const response = await POST(
      new Request('http://localhost/api/admin/settings/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: 'org-1',
          subject: 'English Language Arts',
          subjectKey: 'ela-core',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
  });

  it('rejects non-admin access', async () => {
    requireAdminOrgContextMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      message: 'Forbidden',
    });

    const response = await GET(
      new Request('http://localhost/api/admin/settings/subjects?orgId=org-1'),
    );

    expect(response.status).toBe(403);
    expect((await response.json()).message).toBe('Forbidden');
  });
});
