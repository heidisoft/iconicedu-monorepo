import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  ADMIN_JOB_ACTIVITY_KINDS,
  type AdminJobActivityKind,
} from '@iconicedu/shared-types';

import { Button } from '@iconicedu/ui-web';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { JobActivityDetail } from '@iconicedu/web/app/(app)/[orgSlug]/admin/activity/job-activity-detail';
import {
  AdminPageHeading,
  AdminPageShell,
} from '@iconicedu/web/components/admin/admin-page-layout';
import { getAdminJobActivity } from '@iconicedu/web/lib/admin/job-activity';

function isJobActivityKind(value: string): value is AdminJobActivityKind {
  return (ADMIN_JOB_ACTIVITY_KINDS as readonly string[]).includes(value);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ job: string }>;
}): Promise<Metadata> {
  const { job } = await params;
  return {
    title: `Admin · Job activity · ${job}`,
    description: 'Last 50 processed records for this background job.',
  };
}

export default async function AdminJobActivityDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; job: string }>;
}) {
  const { orgSlug, job } = await params;

  if (!isJobActivityKind(job)) {
    notFound();
  }

  const { account } = await getDashboardAccountContext(orgSlug);
  const overview = await getAdminJobActivity(account.org_id, { kind: job, limit: 50 });
  const group = overview.groups.find((entry) => entry.kind === job);

  if (!group) {
    notFound();
  }

  return (
    <AdminPageShell title={group.title}>
      <AdminPageHeading
        title={group.title}
        description={group.description}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/${orgSlug}/admin/activity`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              All jobs
            </Link>
          </Button>
        }
      />
      <JobActivityDetail group={group} />
    </AdminPageShell>
  );
}
