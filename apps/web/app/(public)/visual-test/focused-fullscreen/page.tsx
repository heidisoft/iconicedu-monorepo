import { notFound } from 'next/navigation';
import { FocusedFullscreenFixture } from '@iconicedu/web/components/live-sessions/zoom-video/focused-fullscreen-fixture';

export default function FocusedFullscreenFixturePage() {
  // flag-exempt: deterministic fullscreen tests, unavailable in production.
  if (process.env.NODE_ENV === 'production') notFound();
  return <FocusedFullscreenFixture />;
}
