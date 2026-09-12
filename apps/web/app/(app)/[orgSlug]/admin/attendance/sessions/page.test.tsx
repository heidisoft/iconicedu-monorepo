import { render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import Page from './page';
import { enableAdminSessionAttendanceAnalytics } from '@iconicedu/web/flags';
import { listAdminSessionCompletions } from '@iconicedu/web/lib/api/session-completions';

vi.mock('@iconicedu/web/flags', () => ({
  enableAdminSessionAttendanceAnalytics: { run: vi.fn() },
}));
vi.mock('@iconicedu/web/lib/api/session-completions', () => ({
  listAdminSessionCompletions: vi.fn(async () => []),
  listOrgRosterForAdmin: vi.fn(async () => []),
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
  }: {
    selectedMonth: string;
    monthOptions: string[];
  }) => (
    <div data-testid="dashboard">
      {selectedMonth}|{monthOptions.join(',')}
    </div>
  ),
}));
vi.mock('./completed-sessions-table', () => ({
  CompletedSessionsTable: () => <div data-testid="table" />,
}));
vi.mock('@iconicedu/web/components/admin/admin-page-layout', () => ({
  AdminPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AdminPageHeading: () => null,
}));

describe('completed sessions date selection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-07T12:00:00Z'));
    vi.mocked(enableAdminSessionAttendanceAnalytics.run).mockResolvedValue(true);
    vi.clearAllMocks();
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
  it('keeps the table view using the bounded API default with analytics disabled', async () => {
    vi.mocked(enableAdminSessionAttendanceAnalytics.run).mockResolvedValue(false);
    render(
      await Page({
        params: Promise.resolve({ orgSlug: 'i' }),
        searchParams: Promise.resolve({ month: '2020-01' }),
      }),
    );
    expect(screen.getByTestId('table')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
    expect(listAdminSessionCompletions).toHaveBeenCalledWith(
      {},
      { orgId: 'org', completedSince: undefined, completedUntil: undefined },
    );
  });
});
