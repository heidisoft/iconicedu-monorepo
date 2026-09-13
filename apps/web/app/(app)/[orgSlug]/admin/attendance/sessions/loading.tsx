import {
  AdminPageHeading,
  AdminPageShell,
} from '@iconicedu/web/components/admin/admin-page-layout';
import { SessionAttendanceDashboardSkeleton } from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/session-attendance-skeletons';

export default function Loading() {
  return (
    <AdminPageShell title="Completed sessions">
      <AdminPageHeading
        title="Completed sessions"
        description="Review session confirmations from the past three months."
      />
      <SessionAttendanceDashboardSkeleton />
    </AdminPageShell>
  );
}
