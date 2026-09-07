import type { Metadata } from 'next';

import { PushNotificationDeliveryStatusDashboard } from '@iconicedu/ui-web';

import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import {
  AdminPageHeading,
  AdminPageShell,
} from '@iconicedu/web/components/admin/admin-page-layout';
import { getAdminActivityFeedAudit } from '@iconicedu/web/lib/admin/activity-feed-audit';

export const metadata: Metadata = {
  title: 'Admin · Push notifications',
  description: 'Track push notification delivery status across generated activity items.',
};

export default async function AdminPushNotificationDeliveryStatusPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { account } = await getDashboardAccountContext(orgSlug);

  const audit = await getAdminActivityFeedAudit(account.org_id, { limit: 1000 });

  return (
    <AdminPageShell title="Push notifications">
      <AdminPageHeading
        title="Push Notification Delivery"
        description="Track delivery status, failures, and recent push notification attempts."
      />
      <PushNotificationDeliveryStatusDashboard audit={audit} />
    </AdminPageShell>
  );
}
