import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  LearningSpaceLifecycleService,
  mapLifecycleError,
  parseLearningSpaceLifecycleInput,
} from './learning-space-lifecycle.service';

const mockRequireAdminAccount = jest.fn();
const mockRpc = jest.fn();
const mockProfiles = jest.fn();

jest.mock('@iconicedu/api/lib/auth/require-admin-account', () => ({
  requireAdminAccount: (...args: unknown[]) => mockRequireAdminAccount(...args),
}));

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: () => {
    const chain: Record<string, unknown> = {};
    ['select', 'eq', 'is', 'order'].forEach((method) => {
      chain[method] = jest.fn(() => chain);
    });
    chain.returns = () => mockProfiles();
    return { from: jest.fn(() => chain), rpc: mockRpc };
  },
}));

jest.mock('@iconicedu/api/modules/reminders/reminder-reconcile.service', () => ({
  ReminderReconcileService: jest.fn(),
}));

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const SPACE_ID = '22222222-2222-4222-8222-222222222222';

function makeService() {
  const reconcile = { reconcileAllSchedulesForLearningSpace: jest.fn(async () => ({})) };
  const service = new LearningSpaceLifecycleService(reconcile as never);
  return { service, reconcile };
}

describe('LearningSpaceLifecycleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdminAccount.mockResolvedValue({ accountId: 'admin-account-1' });
    mockProfiles.mockResolvedValue({
      data: [
        { id: 'guardian-profile-1', kind: 'guardian' },
        { id: 'staff-profile-1', kind: 'staff' },
      ],
      error: null,
    });
  });

  it('archives through the RPC with the admin staff profile as actor', async () => {
    mockRpc.mockResolvedValueOnce({ data: { archived: true }, error: null });
    const { service, reconcile } = makeService();

    const result = await service.run('archive', 'auth-user-1', {
      orgId: ORG_ID,
      learningSpaceId: SPACE_ID,
    });

    expect(mockRequireAdminAccount).toHaveBeenCalledWith('auth-user-1', ORG_ID);
    expect(mockRpc).toHaveBeenCalledWith('archive_learning_space', {
      p_org_id: ORG_ID,
      p_learning_space_id: SPACE_ID,
      p_actor_profile_id: 'staff-profile-1',
    });
    expect(result).toMatchObject({
      action: 'archive',
      changed: true,
      restorableUntil: null,
    });
    expect(reconcile.reconcileAllSchedulesForLearningSpace).not.toHaveBeenCalled();
  });

  it('reports no change when the class is already archived', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { already_archived: true, participants_removed: 0 },
      error: null,
    });
    const { service } = makeService();

    const result = await service.run('archive', 'auth-user-1', {
      orgId: ORG_ID,
      learningSpaceId: SPACE_ID,
    });

    expect(result.changed).toBe(false);
  });

  it('regenerates reminders after a restore', async () => {
    mockRpc.mockResolvedValueOnce({ data: { restored: true }, error: null });
    const { service, reconcile } = makeService();

    await service.run('restore', 'auth-user-1', {
      orgId: ORG_ID,
      learningSpaceId: SPACE_ID,
    });

    expect(mockRpc).toHaveBeenCalledWith('restore_learning_space', expect.any(Object));
    expect(reconcile.reconcileAllSchedulesForLearningSpace).toHaveBeenCalledWith(
      ORG_ID,
      SPACE_ID,
    );
  });

  it('keeps a restore successful when the reminder reconcile fails', async () => {
    mockRpc.mockResolvedValueOnce({ data: { restored: true }, error: null });
    const { service, reconcile } = makeService();
    reconcile.reconcileAllSchedulesForLearningSpace.mockRejectedValueOnce(
      new Error('boom'),
    );

    await expect(
      service.run('restore', 'auth-user-1', { orgId: ORG_ID, learningSpaceId: SPACE_ID }),
    ).resolves.toMatchObject({ changed: true });
  });

  it('returns the restore window for a delete', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { deleted: true, restorable_until: '2026-12-14T00:00:00+00:00' },
      error: null,
    });
    const { service } = makeService();

    const result = await service.run('delete', 'auth-user-1', {
      orgId: ORG_ID,
      learningSpaceId: SPACE_ID,
    });

    expect(mockRpc).toHaveBeenCalledWith('delete_learning_space', expect.any(Object));
    expect(result.restorableUntil).toBe('2026-12-14T00:00:00+00:00');
  });

  it('maps a live session conflict to 409', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: '55006',
        message: 'End the live session before archiving or deleting this class',
      },
    });
    const { service } = makeService();

    await expect(
      service.run('archive', 'auth-user-1', { orgId: ORG_ID, learningSpaceId: SPACE_ID }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('mapLifecycleError', () => {
  it.each([
    ['P0002', NotFoundException],
    ['55000', ConflictException],
    ['55006', ConflictException],
    ['55P03', ConflictException],
    ['42501', ForbiddenException],
    ['XX000', InternalServerErrorException],
  ])('maps %s', (code, expected) => {
    expect(mapLifecycleError({ code, message: 'x' })).toBeInstanceOf(expected);
  });
});

describe('parseLearningSpaceLifecycleInput', () => {
  it('accepts valid ids', () => {
    expect(parseLearningSpaceLifecycleInput(SPACE_ID, { orgId: ORG_ID })).toEqual({
      orgId: ORG_ID,
      learningSpaceId: SPACE_ID,
    });
  });

  it.each([
    ['not-a-uuid', { orgId: ORG_ID }],
    [SPACE_ID, {}],
    [SPACE_ID, null],
    [SPACE_ID, { orgId: 'nope' }],
  ])('rejects %s / %j', (id, body) => {
    expect(() => parseLearningSpaceLifecycleInput(id, body)).toThrow(BadRequestException);
  });
});
