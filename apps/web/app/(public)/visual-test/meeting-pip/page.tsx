import { notFound } from 'next/navigation';
import { MeetingPipFixture } from '@iconicedu/web/components/live-sessions/zoom-video/meeting-pip-fixture';

export default function MeetingPipFixturePage() {
  // flag-exempt: deterministic browser-test infrastructure, unavailable in production.
  if (process.env.NODE_ENV === 'production') notFound();
  return <MeetingPipFixture />;
}
