import { hashWhiteboardToken } from './whiteboard-access';
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
  return { db, grant, current, session, presence };
}
describe('whiteboard API capabilities and atomic persistence', () => {
  beforeEach(() => jest.clearAllMocks());
  it.each([
    ['legacy flag', undefined, [], false],
    [
      'disconnected presenter',
      { presenterId: 'presenter', sessionId: 'session' },
      [],
      false,
    ],
    [
      'another meeting',
      { presenterId: 'presenter', sessionId: 'previous' },
      [{ token_hash: 'presenter', role: 'teacher' }],
      false,
    ],
    [
      'student presence',
      { presenterId: 'presenter', sessionId: 'session' },
      [{ token_hash: 'presenter', role: 'student' }],
      false,
    ],
    [
      'active presenter',
      { presenterId: 'presenter', sessionId: 'session' },
      [{ token_hash: 'presenter', role: 'teacher' }],
      true,
    ],
  ])(
    'resolves %s independently of the cached document revision',
    async (_name, presentation, peers, active) => {
      const { current, presence, grant } = mockDb();
      current.single.mockResolvedValue({
        data: {
          ...board,
          document: { ...board.document, presenting: true, presentation },
        },
        error: null,
      });
      presence.then = builder(peers).then;
      grant.then = presence.then;
      const result = await new WhiteboardsService().get(token, board.revision);
      expect(result.presentationActive).toBe(active);
      expect(result.actorId).toBe(hashWhiteboardToken(token).slice(0, 16));
      expect(result).not.toHaveProperty('document');
      expect(grant.eq).toHaveBeenCalledWith('live_session_id', 'session');
      expect(grant.gt).toHaveBeenCalledWith('last_seen_at', expect.any(String));
    },
  );
  it('records the authorized presenter identity on start and clears it on stop', async () => {
    const { db, current } = mockDb();
    const service = new WhiteboardsService();
    await service.mutate(token, { id: 'start', type: 'presentation', enabled: true });
    expect(db.rpc.mock.calls[0][1].p_document).toMatchObject({
      presenting: true,
      presentation: {
        presenterId: hashWhiteboardToken(token).slice(0, 16),
        sessionId: 'session',
      },
      pages: [{ id: 'one', elements: board.document.pages[0].elements }],
    });
    current.single.mockResolvedValue({
      data: { ...board, document: db.rpc.mock.calls[0][1].p_document },
      error: null,
    });
    await service.mutate(token, { id: 'stop', type: 'presentation', enabled: false });
    expect(db.rpc.mock.calls[1][1].p_document.presenting).toBe(false);
    expect(db.rpc.mock.calls[1][1].p_document).not.toHaveProperty('presentation');
  });
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
