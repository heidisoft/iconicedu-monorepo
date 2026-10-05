import { notFound } from 'next/navigation';

import { ZoomMeetingVisualFixture } from '@iconicedu/web/components/live-sessions/zoom-video/zoom-meeting-visual-fixture';

export default function ZoomMeetingVisualFixturePage() {
  // Test fixture only; never expose synthetic meeting data in production.
  // flag-exempt: deterministic browser-test infrastructure, unavailable in production.
  if (process.env.NODE_ENV === 'production') notFound();

  return <ZoomMeetingVisualFixture />;
}
