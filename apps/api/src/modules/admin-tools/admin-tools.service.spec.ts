import { AdminToolsService } from './admin-tools.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import type { AdminToolKind } from '@iconicedu/shared-types';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));

describe('AdminToolsService', () => {
  const orgId = '00000000-0000-4000-8000-000000000001';
  const events = { dispatchDueJobs: jest.fn() };
  const reminders = {
    dispatchDueReminderJobs: jest.fn(),
    dispatchDueCompletionCheckJobs: jest.fn(),
    resetAndReconcileOrgReminderJobs: jest.fn(),
  };
  const getUser = jest.fn();
  const rpc = jest.fn();
  const filters: Array<[string, unknown]> = [];
  let account: { id: string; primary_role: string } | null;
  let role: { role_key: string } | null;
  beforeEach(() => {
    jest.resetAllMocks();
    filters.length = 0;
    account = { id: 'account-1', primary_role: 'admin' };
    role = { role_key: 'admin' };
    getUser.mockResolvedValue({ data: { user: { id: 'verified-user' } }, error: null });
    jest
      .mocked(createSupabaseSessionClient)
      .mockReturnValue({ auth: { getUser } } as never);
    rpc.mockResolvedValue({ data: 2, error: null });
    jest.mocked(createSupabaseServiceClient).mockReturnValue({
      rpc,
      from: (table: string) => {
        const chain = {
          select: () => chain,
          eq: (key: string, value: unknown) => {
            filters.push([key, value]);
            return chain;
          },
          is: () => chain,
          in: () => chain,
          limit: () => chain,
          maybeSingle: async () => ({
            data: table === 'accounts' ? account : role,
            error: null,
          }),
        };
        return chain;
      },
    } as never);
    events.dispatchDueJobs.mockResolvedValue({ claimed: 1, succeeded: 1, failed: 0 });
    reminders.dispatchDueReminderJobs.mockResolvedValue({ claimed: 1, failed: 0 });
    reminders.dispatchDueCompletionCheckJobs.mockResolvedValue({
      claimed: 3,
      succeeded: 3,
      failed: 0,
    });
    reminders.resetAndReconcileOrgReminderJobs.mockResolvedValue({ compiledCount: 3 });
  });
  const service = () => new AdminToolsService(events as never, reminders as never);

  it.each([
    'session-completions-dispatch',
    'push-notifications-dispatch',
    'schedule-reconciliation-dispatch',
    'events-dispatch',
    'reminders-dispatch',
  ] as AdminToolKind[])(
    'authorizes and scopes %s to the selected organization',
    async (kind) => {
      const result = await service().dispatch('real-token', { orgId, kind, limit: 7 });
      expect(getUser).toHaveBeenCalledWith('real-token');
      expect(filters).toContainEqual(['auth_user_id', 'verified-user']);
      expect(filters).toContainEqual(['org_id', orgId]);
      const handler =
        kind === 'session-completions-dispatch'
          ? reminders.dispatchDueCompletionCheckJobs
          : kind === 'reminders-dispatch'
            ? reminders.dispatchDueReminderJobs
            : events.dispatchDueJobs;
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId,
          limit: 7,
          ...(kind === 'push-notifications-dispatch' ? { pushOnly: true } : {}),
          ...(kind === 'schedule-reconciliation-dispatch' ? { reconcileOnly: true } : {}),
        }),
      );
      expect(result.success).toBe(true);
    },
  );
  it('rejects unverified tokens before any privileged database access', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('invalid token'),
    });
    await expect(
      service().dispatch('forged-token', { orgId, kind: 'push-notifications-dispatch' }),
    ).rejects.toThrow('Unauthorized');
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
    expect(events.dispatchDueJobs).not.toHaveBeenCalled();
  });
  it('rejects an account outside the selected organization', async () => {
    account = null;
    await expect(
      service().dispatch('token', { orgId, kind: 'session-completions-dispatch' }),
    ).rejects.toThrow('Forbidden');
    expect(reminders.dispatchDueCompletionCheckJobs).not.toHaveBeenCalled();
  });
  it('rejects non-admin accounts', async () => {
    account = { id: 'account-1', primary_role: 'educator' };
    role = null;
    await expect(
      service().dispatch('token', { orgId, kind: 'reminder-jobs-reset' }),
    ).rejects.toThrow('Forbidden');
    expect(reminders.resetAndReconcileOrgReminderJobs).not.toHaveBeenCalled();
  });
  it('rejects a revoked admin role even if primary_role is stale', async () => {
    role = null;
    await expect(
      service().dispatch('token', { orgId, kind: 'push-notifications-dispatch' }),
    ).rejects.toThrow('Forbidden');
    expect(events.dispatchDueJobs).not.toHaveBeenCalled();
  });
  it('accepts an explicitly assigned staff role', async () => {
    account = { id: 'account-1', primary_role: 'educator' };
    role = { role_key: 'staff' };
    await expect(
      service().dispatch('token', { orgId, kind: 'events-dispatch' }),
    ).resolves.toMatchObject({ success: true });
    expect(filters).toContainEqual(['account_id', 'account-1']);
  });
  it('repairs only the authorized organization', async () => {
    await expect(
      service().dispatch('token', { orgId, kind: 'channel-read-state-repair' }),
    ).resolves.toMatchObject({
      data: { result: { repairedChannels: 2 } },
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('recompute_all_channel_unread_for_org', {
      p_org_id: orgId,
    });
  });
  it('reports partial worker failures instead of a successful run', async () => {
    reminders.dispatchDueCompletionCheckJobs.mockResolvedValue({
      claimed: 3,
      succeeded: 1,
      failed: 2,
    });
    await expect(
      service().dispatch('token', { orgId, kind: 'session-completions-dispatch' }),
    ).resolves.toMatchObject({
      success: false,
      message: expect.stringContaining('job failures'),
      data: { result: { failed: 2 } },
    });
  });
});
