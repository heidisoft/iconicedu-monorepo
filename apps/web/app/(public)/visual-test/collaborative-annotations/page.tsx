import { notFound } from 'next/navigation';
import { CollaborativeAnnotationFixture } from '@iconicedu/web/components/screen-annotations/collaborative-annotation-fixture';
export default function Page() {
  // flag-exempt: local authenticated annotation collaboration fixture, unavailable in production.
  if (process.env.NODE_ENV === 'production') notFound();
  return <CollaborativeAnnotationFixture />;
}
