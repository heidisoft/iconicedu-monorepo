import { BarChart3 } from 'lucide-react';

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@iconicedu/ui-web/ui/empty';

export function AdminReportEmptyState({
  title = 'No report data yet',
  description = 'This report will populate once the organization has enough activity in the selected time window.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Empty className="min-h-[220px] border px-6 py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BarChart3 className="size-5" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
