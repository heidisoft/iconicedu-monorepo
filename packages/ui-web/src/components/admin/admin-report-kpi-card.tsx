import type { AdminReportKpiVM } from '@iconicedu/shared-types';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@iconicedu/ui-web/ui/card';

export function AdminReportKpiCard({ metric }: { metric: AdminReportKpiVM }) {
  return (
    <Card size="sm" className="gap-2">
      <CardHeader className="gap-1">
        <CardDescription>{metric.label}</CardDescription>
        <CardTitle className="text-3xl font-semibold tracking-tight">
          {metric.value.toLocaleString()}
        </CardTitle>
      </CardHeader>
      {metric.description ? (
        <CardContent className="pt-0 text-sm text-muted-foreground">
          {metric.description}
        </CardContent>
      ) : null}
    </Card>
  );
}
