import { notFound } from 'next/navigation';
import { WhiteboardClassFixture } from '@iconicedu/web/components/whiteboard/whiteboard-class-fixture';
/** flag-exempt: development-only UI entry; real capabilities must be issued by test setup. */
export default function WhiteboardTestPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <WhiteboardClassFixture />;
}
