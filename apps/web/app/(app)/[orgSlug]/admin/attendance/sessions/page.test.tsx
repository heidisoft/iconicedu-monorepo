import { render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import Page from './page';
import { listAdminSessionCompletions } from '@iconicedu/web/lib/api/session-completions';
import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';

vi.mock('@iconicedu/web/lib/api/session-completions', () => ({
  listAdminSessionCompletions: vi.fn(async () => []),
  listOrgRosterForAdmin: vi.fn(async () => []),
}));
vi.mock('@iconicedu/web/lib/api/schedules', () => ({
  listSchedules: vi.fn(async () => []),
}));
vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));
vi.mock('@iconicedu/web/lib/org/builders/org.builder', () => ({
  buildOrgBySlug: vi.fn(async () => ({ id: 'org' })),
}));
vi.mock('@iconicedu/web/lib/admin/require-admin-org-context', () => ({
  requireAdminOrgContext: vi.fn(async () => ({ ok: true, actorProfileId: 'admin' })),
}));
vi.mock('./session-attendance-dashboard', () => ({
  SessionAttendanceDashboard: ({
    selectedMonth,
    monthOptions,
    allowVerifiedDurationOverride,
    showDisputeDetails,
  }: {
    selectedMonth: string;
    monthOptions: string[];
    allowVerifiedDurationOverride: boolean;
    showDisputeDetails: boolean;
  }) => (
    <div
      data-testid="dashboard"
      data-verified-duration={String(allowVerifiedDurationOverride)}
      data-dispute-details={String(showDisputeDetails)}
    >
      {selectedMonth}|{monthOptions.join(',')}
    </div>
  ),
}));
vi.mock('./completed-sessions-table', () => ({
  CompletedSessionsTable: ({
    allowVerifiedDurationOverride,
    showDisputeDetails,
  }: {
    allowVerifiedDurationOverride: boolean;
    showDisputeDetails: boolean;
  }) => (
    <div
      data-testid="table"
      data-verified-duration={String(allowVerifiedDurationOverride)}
      data-dispute-details={String(showDisputeDetails)}
    />
  ),
}));
vi.mock('@iconicedu/web/components/admin/admin-page-layout', () => ({
  AdminPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AdminPageHeading: () => null,
}));

describe('completed sessions date selection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-07T12:00:00Z'));
    vi.clearAllMocks();
    vi.mocked(requireAdminOrgContext).mockResolvedValue({
      ok: true,
      actorProfileId: 'admin',
    } as Awaited<ReturnType<typeof requireAdminOrgContext>>);
  });
  afterEach(() => vi.useRealTimers());
  it.each([undefined, 'all', '2020-01', 'invalid', '2027-01'])(
    'uses the API’s bounded default for month %s',
    async (month) => {
      render(
        await Page({
          params: Promise.resolve({ orgSlug: 'i' }),
          searchParams: Promise.resolve({ month }),
        }),
      );
      expect(screen.getByTestId('dashboard')).toHaveTextContent(
        'all|2026-09,2026-08,2026-07,2026-06',
      );
      expect(listAdminSessionCompletions).toHaveBeenCalledWith(
        {},
        { orgId: 'org', completedSince: undefined, completedUntil: undefined },
      );
    },
  );
  it('allows a month intersecting the three-month window for the API to clamp', async () => {
    render(
      await Page({
        params: Promise.resolve({ orgSlug: 'i' }),
        searchParams: Promise.resolve({ month: '2026-06' }),
      }),
    );
    expect(listAdminSessionCompletions).toHaveBeenCalledWith(
      {},
      {
        orgId: 'org',
        completedSince: '2026-06-01T00:00:00.000Z',
        completedUntil: '2026-07-01T00:00:00.000Z',
      },
    );
  });
  it('gives admins the analytics dashboard with duration overrides and dispute details', async () => {
    render(
      await Page({
        params: Promise.resolve({ orgSlug: 'i' }),
        searchParams: Promise.resolve({}),
      }),
    );
    const dashboard = screen.getByTestId('dashboard');
    expect(dashboard).toHaveAttribute('data-verified-duration', 'true');
    expect(dashboard).toHaveAttribute('data-dispute-details', 'true');
    expect(screen.queryByTestId('table')).not.toBeInTheDocument();
  });
  it('keeps non-admins on the table view with the bounded API default', async () => {
    vi.mocked(requireAdminOrgContext).mockResolvedValue({
      ok: false,
      status: 403,
      message: 'Forbidden',
    } as Awaited<ReturnType<typeof requireAdminOrgContext>>);
    render(
      await Page({
        params: Promise.resolve({ orgSlug: 'i' }),
        searchParams: Promise.resolve({ month: '2020-01' }),
      }),
    );
    const table = screen.getByTestId('table');
    expect(table).toHaveAttribute('data-verified-duration', 'false');
    expect(table).toHaveAttribute('data-dispute-details', 'false');
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
    expect(listAdminSessionCompletions).toHaveBeenCalledWith(
      {},
      { orgId: 'org', completedSince: undefined, completedUntil: undefined },
    );
  });
});
