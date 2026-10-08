import { issueAnnotationAccess } from './annotation-access';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
jest.mock('@iconicedu/api/lib/supabase/service');
it('stores only the hash of a bounded guest credential for the admitted meeting', async () => {
  const insert = jest.fn(async () => ({ error: null }));
  const from = jest.fn(() => ({ insert }));
  jest
    .mocked(createSupabaseServiceClient)
    .mockReturnValue({ from } as unknown as ReturnType<
      typeof createSupabaseServiceClient
    >);
  const token = await issueAnnotationAccess('session', 'Guest');
  expect(token).toMatch(/^[\w-]{43}$/);
  expect(from).toHaveBeenCalledWith('screen_annotation_access');
  expect(insert).toHaveBeenCalledWith({
    live_session_id: 'session',
    token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    display_name: 'Guest',
    expires_at: expect.any(String),
  });
  expect(JSON.stringify(insert.mock.calls)).not.toContain(token);
});
