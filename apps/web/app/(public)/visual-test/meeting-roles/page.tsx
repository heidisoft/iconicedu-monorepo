import { notFound } from 'next/navigation';
import { MeetingRolesEntry } from '@iconicedu/web/components/live-sessions/zoom-video/meeting-roles-entry';
// flag-exempt: deterministic test infrastructure unavailable in production.
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <MeetingRolesEntry />;
}
