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
      'active participant presenter',
      { presenterId: 'presenter', sessionId: 'session' },
      [{ token_hash: 'presenter', role: 'student' }],
      true,
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
  it('allows a participant to present without granting editing permissions', async () => {
    const { db } = mockDb('student', true);
    await new WhiteboardsService().mutate(token, {
      id: 'participant-start',
      type: 'presentation',
      enabled: true,
    });
    expect(db.rpc.mock.calls[0][1].p_document).toMatchObject({
      studentEditing: false,
      presenting: true,
      presentation: {
        presenterId: hashWhiteboardToken(token).slice(0, 16),
        sessionId: 'session',
        presentationId: 'participant-start',
      },
    });
  });
  it.each(['student', 'teacher'])(
    'prevents a %s from stopping or replacing another live presenter',
    async (role) => {
      const { db, current, grant } = mockDb(role);
      current.single.mockResolvedValue({
        data: {
          ...board,
          document: {
            ...board.document,
            presenting: true,
            presentation: { presenterId: 'other', sessionId: 'session' },
          },
        },
        error: null,
      });
      grant.then = builder([{ token_hash: 'other', role: 'student' }]).then;
      const service = new WhiteboardsService();
      await expect(
        service.mutate(token, { id: 'stop-other', type: 'presentation', enabled: false }),
      ).rejects.toThrow('Only the person who started');
      await expect(
        service.mutate(token, {
          id: 'replace-other',
          type: 'presentation',
          enabled: true,
        }),
      ).rejects.toThrow('Another participant');
      expect(db.rpc).not.toHaveBeenCalled();
    },
  );
  it('allows the participant presenter to stop their own presentation', async () => {
    const { db, current } = mockDb('student', true);
    current.single.mockResolvedValue({
      data: {
        ...board,
        document: {
          ...board.document,
          presenting: true,
          presentation: {
            presenterId: hashWhiteboardToken(token).slice(0, 16),
            sessionId: 'session',
          },
        },
      },
      error: null,
    });
    await new WhiteboardsService().mutate(token, {
      id: 'stop-self',
      type: 'presentation',
      enabled: false,
    });
    expect(db.rpc.mock.calls[0][1].p_document.presenting).toBe(false);
    expect(db.rpc.mock.calls[0][1].p_document).not.toHaveProperty('presentation');
  });
  it('replays a participant stop without requiring the cleared presenter identity', async () => {
    const { db, current } = mockDb('student');
    current.single.mockResolvedValue({
      data: { ...board, applied_operations: ['stopped'] },
      error: null,
    });
    await new WhiteboardsService().mutate(token, {
      id: 'stopped',
      type: 'presentation',
      enabled: false,
    });
    expect(db.rpc).not.toHaveBeenCalled();
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

describe('ephemeral whiteboard laser transport', () => {
  const samples = [
    { id: '00000000-0000-4000-8000-000000000001', x: -120, y: 240, button: 'down' },
  ];
  beforeEach(() => jest.clearAllMocks());
  it('allows capability-authenticated guests without changing saved drawings', async () => {
    const { db, grant, current } = mockDb('student');
    await expect(new WhiteboardsService().publishLaser(token, samples)).resolves.toEqual({
      ok: true,
    });
    expect(grant.update).toHaveBeenCalledWith({
      laser_samples: samples,
      laser_updated_at: expect.any(String),
    });
    expect(grant.eq).toHaveBeenCalledWith('token_hash', hashWhiteboardToken(token));
    expect(current.update).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('rejects locked participant writes', async () => {
    const { grant } = mockDb('student', true);
    await expect(new WhiteboardsService().publishLaser(token, samples)).rejects.toThrow(
      'Participant annotation is disabled',
    );
    expect(grant.update).not.toHaveBeenCalled();
  });
  it.each([
    null,
    {},
    Array(65).fill(samples[0]),
    [{ ...samples[0], x: Infinity }],
    [{ ...samples[0], button: 'bad' }],
  ])('rejects invalid or unbounded samples %p', async (value) => {
    mockDb();
    await expect(new WhiteboardsService().publishLaser(token, value)).rejects.toThrow(
      'Invalid laser samples',
    );
  });
  it('scopes fresh laser reads to the verified class and hides grant hashes', async () => {
    const { grant } = mockDb();
    const updated = new Date().toISOString();
    grant.then = builder([
      {
        token_hash: 'b'.repeat(64),
        role: 'student',
        laser_samples: samples,
        laser_updated_at: updated,
      },
    ]).then;
    const result = await new WhiteboardsService().getLasers(token);
    expect(result).toEqual([
      { actorId: 'b'.repeat(16), samples, expiresAt: Date.parse(updated) + 3000 },
    ]);
    expect(grant.eq).toHaveBeenCalledWith('board_id', 'board');
    expect(grant.eq).toHaveBeenCalledWith('live_session_id', 'session');
    expect(grant.gt).toHaveBeenCalledWith('laser_updated_at', expect.any(String));
  });
  it('rejects invalid and expired capabilities on laser reads and writes', async () => {
    const { grant } = mockDb();
    grant.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(new WhiteboardsService().getLasers(token)).rejects.toThrow(
      'Whiteboard access expired',
    );
    await expect(new WhiteboardsService().publishLaser(token, samples)).rejects.toThrow(
      'Whiteboard access expired',
    );
  });
});

describe('whiteboard viewport presence', () => {
  beforeEach(() => jest.clearAllMocks());
  it.each([
    null,
    {},
    { centerX: 0, centerY: 0, zoom: 0 },
    { centerX: Infinity, centerY: 0, zoom: 1 },
    { centerX: 0, centerY: 0, zoom: 31 },
    { centerX: '0', centerY: 0, zoom: 1 },
  ])('rejects malformed viewport %p', async (value) => {
    await expect(new WhiteboardsService().publishViewport(token, value)).rejects.toThrow(
      'Invalid whiteboard viewport',
    );
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
  });
  it('allows view-only participants to publish only their own viewport', async () => {
    const { grant, db } = mockDb('student', true);
    await new WhiteboardsService().publishViewport(token, {
      centerX: 12,
      centerY: -30,
      zoom: 2,
      actorId: 'forged',
    });
    expect(grant.update).toHaveBeenCalledWith({
      viewport: { centerX: 12, centerY: -30, zoom: 2 },
      viewport_updated_at: expect.any(String),
    });
    expect(grant.eq).toHaveBeenCalledWith('token_hash', hashWhiteboardToken(token));
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('scopes reads to the authorized board, session and live capabilities', async () => {
    const { grant } = mockDb();
    const viewport = { centerX: 10, centerY: 20, zoom: 1 };
    grant.then = builder([
      {
        token_hash: hashWhiteboardToken(token),
        viewport,
        viewport_updated_at: new Date().toISOString(),
      },
      {
        token_hash: 'peer'.repeat(16),
        viewport,
        viewport_updated_at: new Date().toISOString(),
      },
    ]).then;
    const result = await new WhiteboardsService().getViewports(token);
    expect(result).toEqual([
      { actorId: 'peer'.repeat(4), viewport, expiresAt: expect.any(Number) },
    ]);
    expect(grant.eq).toHaveBeenCalledWith('board_id', 'board');
    expect(grant.eq).toHaveBeenCalledWith('live_session_id', 'session');
    expect(grant.gt).toHaveBeenCalledWith('expires_at', expect.any(String));
    expect(grant.gt).toHaveBeenCalledWith('viewport_updated_at', expect.any(String));
  });
  it('rejects expired capabilities for viewport publication', async () => {
    const { grant } = mockDb();
    grant.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(
      new WhiteboardsService().publishViewport(token, {
        centerX: 0,
        centerY: 0,
        zoom: 1,
      }),
    ).rejects.toThrow('Whiteboard access expired');
    expect(grant.update).not.toHaveBeenCalled();
  });
});

describe('whiteboard writing focus', () => {
  beforeEach(() => jest.clearAllMocks());
  it('keeps validated writing coordinates in ephemeral presence and strips extra data', async () => {
    const { grant } = mockDb('teacher', true);
    await new WhiteboardsService().publishViewport(token, {
      centerX: 0,
      centerY: 0,
      zoom: 1,
      writing: { x: 1200, y: -400, actorId: 'forged' },
    });
    expect(grant.update).toHaveBeenCalledWith({
      viewport: { centerX: 0, centerY: 0, zoom: 1, writing: { x: 1200, y: -400 } },
      viewport_updated_at: expect.any(String),
    });
  });
  it.each([null, {}, { x: '1', y: 0 }, { x: 0, y: Infinity }, { x: 10000001, y: 0 }])(
    'rejects invalid writing focus %p',
    async (writing) => {
      await expect(
        new WhiteboardsService().publishViewport(token, {
          centerX: 0,
          centerY: 0,
          zoom: 1,
          writing,
        }),
      ).rejects.toThrow('Invalid whiteboard viewport');
      expect(createSupabaseServiceClient).not.toHaveBeenCalled();
    },
  );
});
