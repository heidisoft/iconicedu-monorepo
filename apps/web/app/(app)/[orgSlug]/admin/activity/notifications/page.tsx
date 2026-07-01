import type { Metadata } from 'next';

import {
  DashboardHeader,
  PushNotificationDeliveryStatusDashboard,
} from '@iconicedu/ui-web';

import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
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
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Push notifications" />
      <div className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Push Notification Delivery
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track delivery status, failures, and recent push notification attempts.
            </p>
          </div>
        </div>
        <PushNotificationDeliveryStatusDashboard audit={audit} />
      </div>
    </div>
  );
}
