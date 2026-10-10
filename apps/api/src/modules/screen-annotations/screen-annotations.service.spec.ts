import { ScreenAnnotationsService } from './screen-annotations.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
jest.mock('@iconicedu/api/lib/supabase/service');
jest.mock('@iconicedu/api/lib/supabase/session');
const rpc = jest.fn();
const getUser = jest.fn();
const pointerRows = jest.fn();
const upsert = jest.fn();
const context = {
  actor: { userId: 'verified-user', name: 'Teacher', role: 'educator' },
  actors: [{ userId: 'verified-user', name: 'Teacher', role: 'educator' }],
  snapshot: { roomId: 'room', studentsEnabled: true, ended: false },
};
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(createSupabaseServiceClient).mockReturnValue({
    rpc,
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        gt: () => query,
        limit: pointerRows,
        upsert,
      };
      return query;
    },
  } as unknown as ReturnType<typeof createSupabaseServiceClient>);
  jest
    .mocked(createSupabaseSessionClient)
    .mockReturnValue({ auth: { getUser } } as unknown as ReturnType<
      typeof createSupabaseSessionClient
    >);
  getUser.mockResolvedValue({ data: { user: { id: 'verified-user' } }, error: null });
  pointerRows.mockResolvedValue({ data: [], error: null });
  upsert.mockResolvedValue({ error: null });
});
describe('screen annotation authorization', () => {
  it('loads annotation state for an authenticated participant without a rollout flag', async () => {
    rpc.mockResolvedValue({ data: context, error: null });
    await expect(
      new ScreenAnnotationsService().context('token', 'session', '123'),
    ).resolves.toEqual({ ...context, pointers: [] });
    expect(rpc).toHaveBeenCalledWith('screen_annotation_context', {
      p_session: 'session',
      p_user: 'verified-user',
      p_share: '123',
    });
  });
  it('uses the verified token user for membership and object ownership', async () => {
    rpc.mockResolvedValue({ data: { revision: 1 }, error: null });
    await new ScreenAnnotationsService().apply('token', 'room', {
      kind: 'clear',
      scope: 'all',
      eventId: 'event',
    });
    expect(rpc).toHaveBeenCalledWith(
      'screen_annotation_apply',
      expect.objectContaining({ p_user: 'verified-user' }),
    );
  });
  it('rejects invalid sessions and maps version conflicts without leaking SQL', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new Error('bad token') });
    await expect(
      new ScreenAnnotationsService().context('bad', 'session', '1'),
    ).rejects.toThrow('Authentication required');
    getUser.mockResolvedValue({ data: { user: { id: 'verified-user' } }, error: null });
    rpc.mockResolvedValue({ data: null, error: { message: 'annotation_conflict' } });
    await expect(
      new ScreenAnnotationsService().apply('token', 'room', {
        kind: 'end',
        eventId: 'event',
      }),
    ).rejects.toThrow('Annotation changed');
  });
});

it('hashes guest capabilities and delegates meeting/room scope checks to the transaction', async () => {
  rpc.mockResolvedValue({
    data: { ...context, actor: { ...context.actor, role: 'student' } },
    error: null,
  });
  const service = new ScreenAnnotationsService();
  await service.guestContext('a'.repeat(43), 'session', '123');
  expect(getUser).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledWith('screen_annotation_guest_context', {
    p_session: 'session',
    p_share: '123',
    p_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
  rpc.mockResolvedValue({ data: null, error: { message: 'annotation_guest_expired' } });
  await expect(
    service.guestApply('a'.repeat(43), 'other-room', { kind: 'end', eventId: 'event' }),
  ).rejects.toThrow('Rejoin the meeting');
});
it('rejects missing or malformed guest credentials before accessing annotation data', async () => {
  await expect(
    new ScreenAnnotationsService().guestContext('', 'session', '123'),
  ).rejects.toThrow('Rejoin the meeting');
  expect(rpc).not.toHaveBeenCalled();
});

it('publishes authenticated and guest pointer names from the verified actor, never the payload', async () => {
  rpc.mockResolvedValue({ data: context, error: null });
  const service = new ScreenAnnotationsService();
  const input = {
    point: { x: 0.2, y: 0.4 },
    tool: 'spotlight' as const,
    color: '#16a34a',
  };
  await service.pointer('token', 'session', '123', input);
  await service.pointer('a'.repeat(43), 'session', '123', input, true);
  expect(upsert).toHaveBeenCalledTimes(2);
  expect(upsert).toHaveBeenLastCalledWith(
    expect.objectContaining({
      room_id: 'room',
      user_id: 'verified-user',
      name: 'Teacher',
      color: '#16a34a',
      x: 0.2,
      y: 0.4,
    }),
    { onConflict: 'room_id,user_id' },
  );
  const expiry = new Date(upsert.mock.calls[0][0].expires_at).getTime();
  expect(expiry - Date.now()).toBeGreaterThan(2500);
  expect(expiry - Date.now()).toBeLessThanOrEqual(3000);
});
it('filters pointers from removed participants and disabled students, even when stale rows remain', async () => {
  rpc.mockResolvedValue({
    data: { ...context, snapshot: { ...context.snapshot, studentsEnabled: false } },
    error: null,
  });
  pointerRows.mockResolvedValue({
    data: [
      {
        user_id: 'verified-user',
        name: 'Spoofed',
        x: 0.2,
        y: 0.3,
        tool: 'spotlight',
        color: '#16a34a',
        expires_at: new Date(Date.now() + 3000).toISOString(),
      },
      { user_id: 'removed', name: 'Removed' },
    ],
    error: null,
  });
  const value = await new ScreenAnnotationsService().context('token', 'session', '123');
  expect(value.pointers).toHaveLength(1);
  expect(value.pointers?.[0].name).toBe('Teacher');
});
it('rejects pointer publication by a disabled participant or an expired guest', async () => {
  rpc.mockResolvedValue({
    data: {
      ...context,
      actor: { ...context.actor, role: 'student' },
      snapshot: { ...context.snapshot, studentsEnabled: false },
    },
    error: null,
  });
  const service = new ScreenAnnotationsService();
  const input = {
    point: { x: 0.2, y: 0.4 },
    tool: 'spotlight' as const,
    color: '#16a34a',
  };
  await expect(service.pointer('token', 'session', '123', input)).rejects.toThrow(
    'Annotation access denied',
  );
  rpc.mockResolvedValue({ data: null, error: { message: 'annotation_guest_expired' } });
  await expect(
    service.pointer('a'.repeat(43), 'session', '123', input, true),
  ).rejects.toThrow('Rejoin the meeting');
  expect(upsert).not.toHaveBeenCalled();
});
