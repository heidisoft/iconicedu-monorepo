import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSupabaseServerClientMock = vi.fn();
const buildOrgBySlugMock = vi.fn();
const getAccountByAuthUserIdInOrgMock = vi.fn();
const revalidatePathMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) =>
    createSupabaseServerClientMock(...args),
}));

vi.mock('@iconicedu/web/lib/org/builders/org.builder', () => ({
  buildOrgBySlug: (...args: unknown[]) => buildOrgBySlugMock(...args),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserIdInOrg: (...args: unknown[]) =>
    getAccountByAuthUserIdInOrgMock(...args),
}));

vi.mock('@iconicedu/web/lib/api/http-client', () => ({
  createApiClient: vi.fn(() => ({ post: apiPostMock })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

import { cancelClassScheduleSessionAction } from './cancel-class-schedule-session';

function createServerSupabase() {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: { id: 'auth-1' },
        },
      })),
      getSession: vi.fn(async () => ({
        data: { session: { access_token: 'token-1' } },
      })),
    },
  };
}

describe('cancelClassScheduleSessionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createSupabaseServerClientMock.mockResolvedValue(createServerSupabase());
    buildOrgBySlugMock.mockResolvedValue({ id: 'org-1', slug: 'iconic-academy' });
    getAccountByAuthUserIdInOrgMock.mockResolvedValue({
      data: { id: 'account-1', org_id: 'org-1', primary_role: 'owner' },
    });
  });

  it('delegates session cancellation to the API for recurring sessions', async () => {
    apiPostMock.mockResolvedValue({ mode: 'recurring' });

    const result = await cancelClassScheduleSessionAction({
      orgSlug: 'iconic-academy',
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T10:00:00.000Z',
      reason: ' Tutor unavailable ',
    });

    expect(apiPostMock).toHaveBeenCalledWith('/schedules/session/cancel', {
      orgId: 'org-1',
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T10:00:00.000Z',
      reason: 'Tutor unavailable',
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/iconic-academy/class-schedule');
    expect(result).toEqual({
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T10:00:00.000Z',
      reason: 'Tutor unavailable',
      mode: 'recurring',
    });
  });

  it('delegates session cancellation to the API for single sessions', async () => {
    apiPostMock.mockResolvedValue({ mode: 'single' });

    const result = await cancelClassScheduleSessionAction({
      orgSlug: 'iconic-academy',
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T10:00:00.000Z',
      reason: null,
    });

    expect(apiPostMock).toHaveBeenCalledWith('/schedules/session/cancel', {
      orgId: 'org-1',
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T10:00:00.000Z',
      reason: null,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/iconic-academy/class-schedule');
    expect(result).toEqual({
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-21T10:00:00.000Z',
      reason: null,
      mode: 'single',
    });
  });

  it('rejects non-staff non-owner profiles', async () => {
    getAccountByAuthUserIdInOrgMock.mockResolvedValue({
      data: { id: 'account-1', org_id: 'org-1', primary_role: 'guardian' },
    });

    await expect(
      cancelClassScheduleSessionAction({
        orgSlug: 'iconic-academy',
        scheduleId: 'schedule-1',
        occurrenceKey: '2026-03-21T10:00:00.000Z',
      }),
    ).rejects.toThrow('Only staff or owner users can cancel sessions.');
  });
});
