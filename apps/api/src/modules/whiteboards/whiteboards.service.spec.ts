import { WhiteboardsService } from './whiteboards.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
jest.mock('@iconicedu/api/lib/supabase/service');
const token = 'a'.repeat(43);
const board = {
  id: 'board',
  revision: 0,
  applied_operations: [],
  document: {
    schemaVersion: 1,
    studentEditing: true,
    pages: [{ id: 'one', title: 'Page 1', elements: [] }],
  },
};
function builder(data: unknown, error: unknown = null) {
  const response = { data, error };
  const q: Record<string, jest.Mock> = {};
  for (const method of ['select', 'eq', 'gt', 'is', 'update'])
    q[method] = jest.fn(() => q);
  q.single = jest.fn(async () => response);
  q.maybeSingle = jest.fn(async () => response);
  q.then = jest.fn((resolve: (v: unknown) => unknown) =>
    Promise.resolve(response).then(resolve),
  );
  return q;
}
function mockDb(role = 'teacher', locked = false) {
  const grant = builder({ board_id: 'board', role, live_session_id: 'session' }),
    session = builder({ id: 'session', status: 'live' }),
    current = builder({
      ...board,
      document: { ...board.document, studentEditing: !locked },
    }),
    presence = builder([]);
  const db = {
    from: jest.fn((name: string) =>
      name === 'classroom_whiteboards'
        ? current
        : name === 'channel_live_sessions'
          ? session
          : grant,
    ),
    rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
  };
  grant.then = presence.then;
  jest
    .mocked(createSupabaseServiceClient)
    .mockReturnValue(db as unknown as ReturnType<typeof createSupabaseServiceClient>);
  return { db, grant, current, session };
}
describe('whiteboard API capabilities and atomic persistence', () => {
  beforeEach(() => jest.clearAllMocks());
  it('rejects missing, forged and expired capabilities', async () => {
    const service = new WhiteboardsService();
    await expect(service.get('')).rejects.toThrow('expired');
    const { grant } = mockDb();
    grant.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(service.get(token)).rejects.toThrow('expired');
  });
  it('does not return or modify a board after the class ends', async () => {
    const { session, db } = mockDb();
    session.maybeSingle.mockResolvedValue({
      data: { id: 'session', status: 'ended' },
      error: null,
    });
    await expect(
      new WhiteboardsService().mutate(token, {
        id: 'op',
        type: 'student-editing',
        enabled: false,
      }),
    ).rejects.toThrow('ended');
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('rejects student writes when locked and teacher-only page operations', async () => {
    const { db } = mockDb('student', true);
    await expect(
      new WhiteboardsService().mutate(token, {
        id: 'op',
        type: 'elements',
        pageId: 'one',
        elements: [],
      }),
    ).rejects.toThrow('locked');
    expect(db.rpc).not.toHaveBeenCalled();
    mockDb('student');
    await expect(
      new WhiteboardsService().mutate(token, {
        id: 'op',
        type: 'add-page',
        pageId: 'two',
        title: 'Page 2',
      }),
    ).rejects.toThrow('locked');
  });
  it('retries CAS conflicts against the latest board and never replaces another board', async () => {
    const { db } = mockDb();
    db.rpc.mockResolvedValueOnce({ data: false, error: null });
    await new WhiteboardsService().mutate(token, {
      id: 'op',
      type: 'student-editing',
      enabled: false,
    });
    expect(db.rpc).toHaveBeenCalledTimes(2);
    expect(db.rpc.mock.calls[0][1]).toMatchObject({
      p_board_id: 'board',
      p_revision: 0,
      p_operation_id: 'op',
    });
  });
  it('deduplicates replayed operations and returns safe failures', async () => {
    const { current, db } = mockDb();
    current.single.mockResolvedValue({
      data: { ...board, applied_operations: ['op'] },
      error: null,
    });
    await new WhiteboardsService().mutate(token, {
      id: 'op',
      type: 'student-editing',
      enabled: false,
    });
    expect(db.rpc).not.toHaveBeenCalled();
    const next = mockDb();
    next.db.rpc.mockResolvedValue({ data: null, error: { message: 'private DB error' } });
    await expect(
      new WhiteboardsService().mutate(token, {
        id: 'other',
        type: 'student-editing',
        enabled: false,
      }),
    ).rejects.toThrow('Unable to save');
  });
});
