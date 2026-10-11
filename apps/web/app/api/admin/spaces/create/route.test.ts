import { beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_LIVE_SESSION_SETTINGS } from '@iconicedu/shared-types';
import { POST } from './route';
const { create, save } = vi.hoisted(() => ({ create: vi.fn(), save: vi.fn() }));
vi.mock('@iconicedu/web/lib/admin/learning-space-create', () => ({
  createLearningSpaceFromPayload: create,
}));
vi.mock('@iconicedu/web/lib/admin/save-classroom-meeting-settings', () => ({
  saveClassroomMeetingSettings: save,
}));
beforeEach(() => {
  create.mockReset();
  save.mockReset();
  create.mockResolvedValue({
    learningSpaceId: 'classroom',
    channelId: 'channel',
    scheduleIds: [],
  });
});
function request(settings = true) {
  return new Request('http://localhost/api/admin/spaces/create', {
    method: 'POST',
    body: JSON.stringify({
      basics: { title: 'Test', kind: 'small_group', iconKey: 'book' },
      participants: [{ profileId: 'participant' }],
      liveSession: {
        enabled: true,
        provider: 'zoom',
        ...(settings ? { settings: DEFAULT_LIVE_SESSION_SETTINGS } : {}),
      },
    }),
  });
}
it('saves meeting options through the owning API adapter after Classroom creation', async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(save).toHaveBeenCalledWith('classroom', DEFAULT_LIVE_SESSION_SETTINGS);
});
it('returns the created id for safe retry if meeting settings fail', async () => {
  save.mockRejectedValue(new Error('Synthetic API error'));
  const response = await POST(request());
  expect(response.status).toBe(502);
  expect(await response.json()).toMatchObject({
    success: false,
    data: { learningSpaceId: 'classroom' },
    message: expect.stringContaining('Retry'),
  });
});
it('keeps the legacy flag-off creation path unchanged', async () => {
  const response = await POST(request(false));
  expect(response.status).toBe(200);
  expect(save).not.toHaveBeenCalled();
});
