import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ChannelLiveSessionConfigVM } from '@iconicedu/shared-types';
import { DEFAULT_LIVE_SESSION_SETTINGS } from '@iconicedu/shared-types';
import { ClassroomMeetingFeatureSettings } from './classroom-meeting-feature-settings';
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('next/navigation', () => ({ useParams: () => ({ orgSlug: 'academy' }) }));
vi.mock('@iconicedu/web/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}));
vi.mock('@iconicedu/web/lib/live-sessions/classroom-meeting-settings-api', () => ({
  classroomMeetingSettingsApi: () => ({ get }),
}));
function Harness() {
  const [value, setValue] = useState<ChannelLiveSessionConfigVM>({
    enabled: true,
    provider: 'zoom',
  });
  return (
    <ClassroomMeetingFeatureSettings
      classroomId="class"
      value={value}
      onChange={setValue}
    />
  );
}
beforeEach(() => {
  get.mockReset();
});
it('hides new options when the server flag is off', async () => {
  get.mockResolvedValue({ enabled: false, settings: DEFAULT_LIVE_SESSION_SETTINGS });
  render(<Harness />);
  await waitFor(() => expect(get).toHaveBeenCalledWith('academy', 'class'));
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});
it('hydrates options from API-owned saved settings when the flag is on', async () => {
  get.mockResolvedValue({
    enabled: true,
    settings: { ...DEFAULT_LIVE_SESSION_SETTINGS, invite: { enabled: false } },
  });
  render(<Harness />);
  expect(
    await screen.findByRole('checkbox', { name: 'Shared Invite' }),
  ).not.toBeChecked();
});
