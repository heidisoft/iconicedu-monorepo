import { ScreenAnnotationsService } from './screen-annotations.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { evaluateApiBooleanFlag } from '@iconicedu/api/lib/flags/posthog-openfeature';
jest.mock('@iconicedu/api/lib/supabase/service');
jest.mock('@iconicedu/api/lib/supabase/session');
jest.mock('@iconicedu/api/lib/flags/posthog-openfeature');
const rpc = jest.fn();
const getUser = jest.fn();
beforeEach(() => {
  jest.resetAllMocks();
  jest
    .mocked(createSupabaseServiceClient)
    .mockReturnValue({ rpc } as unknown as ReturnType<
      typeof createSupabaseServiceClient
    >);
  jest
    .mocked(createSupabaseSessionClient)
    .mockReturnValue({ auth: { getUser } } as unknown as ReturnType<
      typeof createSupabaseSessionClient
    >);
  getUser.mockResolvedValue({ data: { user: { id: 'verified-user' } }, error: null });
  jest.mocked(evaluateApiBooleanFlag).mockResolvedValue(true);
});
describe('screen annotation authorization', () => {
  it('gates OFF on the server before accessing any annotation state', async () => {
    jest.mocked(evaluateApiBooleanFlag).mockResolvedValue(false);
    await expect(
      new ScreenAnnotationsService().context('token', 'session', '123'),
    ).rejects.toThrow('not enabled');
    expect(rpc).not.toHaveBeenCalled();
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
