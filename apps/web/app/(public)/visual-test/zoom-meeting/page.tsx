import { notFound } from 'next/navigation';

import { ZoomMeetingVisualFixture } from '@iconicedu/web/components/live-sessions/zoom-video/zoom-meeting-visual-fixture';

export default async function ZoomMeetingVisualFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ participants?: string }>;
}) {
  // Test fixture only; never expose synthetic meeting data in production.
  // flag-exempt: deterministic browser-test infrastructure, unavailable in production.
  if (process.env.NODE_ENV === 'production') notFound();

  const params = await searchParams;
  const count = Number(params.participants);
  return (
    <ZoomMeetingVisualFixture
      participantCount={[1, 2, 3, 4].includes(count) ? count : 4}
    />
  );
}
