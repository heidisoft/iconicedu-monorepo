import { redirectClassroomLink } from '@/lib/classroom/incoming-link';
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return redirectClassroomLink(path);
}
