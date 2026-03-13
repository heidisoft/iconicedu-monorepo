'use client';

import { CalendarX2 } from 'lucide-react';

import { EmptyStateCard } from '@iconicedu/ui-web/components/empty/empty-state-card';

export function DashboardSessionsEmptyState() {
  return (
    <EmptyStateCard
      title="No upcoming sessions this week"
      description="New sessions will appear here once they are scheduled."
      icon={<CalendarX2 className="size-5" aria-hidden="true" />}
    />
  );
}
