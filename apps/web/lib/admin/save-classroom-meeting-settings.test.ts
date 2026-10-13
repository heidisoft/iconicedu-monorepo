import { beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_LIVE_SESSION_SETTINGS } from '@iconicedu/shared-types';
import { saveClassroomMeetingSettings } from './save-classroom-meeting-settings';
const { flag, auth, save } = vi.hoisted(() => ({
  flag: vi.fn(),
  auth: vi.fn(),
  save: vi.fn(),
}));
vi.mock('@iconicedu/web/flags', () => ({
  enableClassroomMeetingSettings: { run: flag },
}));
vi.mock('./_auth-context', () => ({ requireAdminAuthContext: auth }));
vi.mock('@iconicedu/web/lib/live-sessions/classroom-meeting-settings-api', () => ({
  classroomMeetingSettingsApi: () => ({ save }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ supabase: {}, orgId: 'org', profileId: 'manager' });
});
it('gates server-side option saves when the web flag is off', async () => {
  flag.mockResolvedValue(false);
  await expect(
    saveClassroomMeetingSettings('class', DEFAULT_LIVE_SESSION_SETTINGS),
  ).rejects.toThrow('not enabled');
  expect(save).not.toHaveBeenCalled();
});
it('forwards manager context to the owning API when the flag is on', async () => {
  flag.mockResolvedValue(true);
  await saveClassroomMeetingSettings('class', DEFAULT_LIVE_SESSION_SETTINGS);
  expect(flag.mock.calls[0][0].identify()).toEqual({ profileId: 'manager' });
  expect(save).toHaveBeenCalledWith({
    orgId: 'org',
    profileId: 'manager',
    classroomId: 'class',
    settings: DEFAULT_LIVE_SESSION_SETTINGS,
  });
});
