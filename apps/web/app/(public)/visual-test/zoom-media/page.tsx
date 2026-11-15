import { notFound } from 'next/navigation';
import { ZoomMediaFixture } from '@iconicedu/web/components/live-sessions/zoom-video/zoom-media-fixture';

/** flag-exempt: deterministic renderer tests, unavailable in production. */
export default function ZoomMediaFixturePage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <ZoomMediaFixture />;
}
