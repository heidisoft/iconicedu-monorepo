import * as React from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@iconicedu/ui-web/ui/card';
import { cn } from '@iconicedu/ui-web/lib/utils';

import { AdminReportEmptyState } from './admin-report-empty-state';

export function AdminReportChartCard({
  title,
  description,
  isEmpty,
  emptyTitle,
  emptyDescription,
  footer,
  className,
  children,
}: {
  title: string;
  description?: string;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {isEmpty ? (
          <AdminReportEmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          children
        )}
        {footer}
      </CardContent>
    </Card>
  );
}
