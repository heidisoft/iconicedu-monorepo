import type { Metadata } from 'next';

import { DashboardHeader } from '@iconicedu/ui-web';

import { getAdminChannelRows } from '@iconicedu/web/lib/admin/channels';
import { ChannelsDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/channels/channels-dashboard';

export const metadata: Metadata = {
  title: 'Admin · Channels',
  description: 'Review and manage all channels across the organization.',
};

export default async function AdminChannelsPage() {
  const rows = await getAdminChannelRows();

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Channels" />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <ChannelsDashboard rows={rows} />
      </div>
    </div>
  );
}
