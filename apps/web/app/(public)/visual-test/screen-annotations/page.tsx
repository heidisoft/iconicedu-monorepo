import { notFound } from 'next/navigation';
import { AnnotationVisualFixture } from '@iconicedu/web/components/screen-annotations/annotation-visual-fixture';
export default function ScreenAnnotationFixturePage() {
  // flag-exempt: deterministic annotation browser fixture, unavailable in production.
  if (process.env.NODE_ENV === 'production') notFound();
  return <AnnotationVisualFixture />;
}
