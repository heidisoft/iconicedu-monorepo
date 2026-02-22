import type { Metadata } from 'next';

import { DashboardHeader } from '@iconicedu/ui-web';

import { getAdminDirectMessageRows } from '@iconicedu/web/lib/admin/channels';
import { ChannelsDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/channels/channels-dashboard';

export const metadata: Metadata = {
  title: 'Admin · Direct Messages',
  description: 'Review and manage all direct message channels across the organization.',
};

export default async function AdminDirectMessagesPage() {
  const rows = await getAdminDirectMessageRows();

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Direct Messages" />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <ChannelsDashboard rows={rows} />
      </div>
    </div>
  );
}
