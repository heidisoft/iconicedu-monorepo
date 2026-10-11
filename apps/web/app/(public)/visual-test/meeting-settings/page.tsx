import { notFound } from 'next/navigation';
import { MeetingSettingsFixture } from '@iconicedu/web/components/live-sessions/zoom-video/meeting-settings-fixture';
/** flag-exempt: deterministic browser-test infrastructure, unavailable in production. */
export default function MeetingSettingsPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <MeetingSettingsFixture />;
}
