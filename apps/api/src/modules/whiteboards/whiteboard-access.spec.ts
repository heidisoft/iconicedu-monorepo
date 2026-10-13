import { issueWhiteboardAccess, hashWhiteboardToken } from './whiteboard-access';
import { evaluateApiBooleanFlag } from '@iconicedu/api/lib/flags/posthog-openfeature';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
jest.mock('@iconicedu/api/lib/flags/posthog-openfeature');
jest.mock('@iconicedu/api/lib/supabase/service');
const session = {
  org_id: 'org',
  channel_id: 'channel',
  occurrence_key: '2026-10-06T12:00:00Z',
  started_by_profile_id: 'teacher',
  app_metadata: { scheduleId: 'schedule' },
};
function database(provider?: string) {
  const row = {
    ...session,
    app_metadata: {
      ...session.app_metadata,
      ...(provider ? { meetingSettings: { whiteboard: { provider } } } : {}),
    },
  };
  const board = {
    select: jest.fn(),
    eq: jest.fn(),
    single: jest.fn().mockResolvedValue({ data: { id: 'board' }, error: null }),
    upsert: jest.fn().mockResolvedValue({ error: null }),
  };
  board.select.mockReturnValue(board);
  board.eq.mockReturnValue(board);
  const sessionQuery = {
    select: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue({ data: row, error: null }),
  };
  for (const name of ['select', 'eq', 'is'] as const)
    sessionQuery[name].mockReturnValue(sessionQuery);
  const access = { insert: jest.fn().mockResolvedValue({ error: null }) };
  const db = {
    from: jest.fn((name: string) =>
      name === 'channel_live_sessions'
        ? sessionQuery
        : name === 'classroom_whiteboards'
          ? board
          : access,
    ),
  };
  jest
    .mocked(createSupabaseServiceClient)
    .mockReturnValue(db as unknown as ReturnType<typeof createSupabaseServiceClient>);
  return { db, board, access };
}
describe('authorized whiteboard provider issuance', () => {
  beforeEach(() => jest.clearAllMocks());
  it('keeps Zoom when the rollout is OFF without creating a board', async () => {
    const { board } = database();
    jest.mocked(evaluateApiBooleanFlag).mockResolvedValue(false);
    expect(await issueWhiteboardAccess('session', 'student', 'Student')).toEqual({
      provider: 'zoom',
    });
    expect(board.upsert).not.toHaveBeenCalled();
  });
  it('defaults to Excalidraw when ON and scopes grants to the authorized role', async () => {
    const { board, access } = database();
    jest.mocked(evaluateApiBooleanFlag).mockResolvedValue(true);
    const result = await issueWhiteboardAccess('session', 'student', 'Student');
    expect(result.provider).toBe('excalidraw');
    expect(result.token).toHaveLength(43);
    expect(board.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        scope_key: 'scheduled:schedule:2026-10-06T12:00:00Z',
        document: expect.objectContaining({ studentEditing: true }),
      }),
      expect.objectContaining({ ignoreDuplicates: true }),
    );
    expect(access.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        board_id: 'board',
        live_session_id: 'session',
        role: 'student',
        token_hash: hashWhiteboardToken(result.token!),
      }),
    );
    expect(JSON.stringify(access.insert.mock.calls)).not.toContain(result.token!);
  });
  it('retains the explicit Zoom provider under the rollout', async () => {
    const { board } = database('zoom');
    jest.mocked(evaluateApiBooleanFlag).mockResolvedValue(true);
    expect(await issueWhiteboardAccess('session', 'teacher', 'Teacher')).toEqual({
      provider: 'zoom',
    });
    expect(board.upsert).not.toHaveBeenCalled();
  });
});
