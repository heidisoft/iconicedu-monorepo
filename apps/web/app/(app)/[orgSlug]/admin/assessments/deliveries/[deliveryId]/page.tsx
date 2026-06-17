import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import {
  DashboardHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
} from '@iconicedu/ui-web';
import { Users, BarChart2, ExternalLink } from 'lucide-react';
import { DeliverySharePanel } from '@iconicedu/web/components/assessments/delivery-share-panel';

export const metadata: Metadata = { title: 'Admin · Delivery Results' };

export default async function DeliveryResultsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; deliveryId: string }>;
}) {
  const { orgSlug, deliveryId } = await params;
  const { supabase } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const api = createAssessmentApiClient(supabase);
  const [delivery, results] = await Promise.all([
    api.getDelivery(deliveryId, org.id).catch(() => null),
    api.getDeliveryResults(deliveryId).catch(() => ({ sessions: [] })) as Promise<{
      sessions: {
        id: string;
        anonName?: string;
        profileName?: string;
        percentage?: number;
        completedAt?: string;
        status: string;
      }[];
    }>,
  ]);
  if (!delivery) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title={delivery.title} description={delivery.testTitle} />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">
                Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{delivery.sessionCount ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{delivery.completedCount ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">
                Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={delivery.accessType === 'public' ? 'default' : 'secondary'}>
                {delivery.accessType}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Share panel */}
        {delivery.accessType === 'public' && (
          <DeliverySharePanel
            deliveryId={delivery.id}
            accessToken={delivery.accessToken}
            publicUrl={delivery.publicUrl}
            orgId={org.id}
          />
        )}

        {/* Sessions table */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Sessions</CardTitle>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                {(results as { sessions: unknown[] }).sessions.length}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {(
              results as {
                sessions: {
                  id: string;
                  anonName?: string;
                  profileName?: string;
                  percentage?: number;
                  completedAt?: string;
                  status: string;
                }[];
              }
            ).sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground px-4 py-6 text-center">
                No sessions yet.
              </p>
            ) : (
              <div className="flex flex-col">
                {(
                  results as {
                    sessions: {
                      id: string;
                      anonName?: string;
                      profileName?: string;
                      percentage?: number;
                      completedAt?: string;
                      status: string;
                    }[];
                  }
                ).sessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/${orgSlug}/admin/assessments/deliveries/${deliveryId}/results/${session.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors border-b last:border-b-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {session.profileName ?? session.anonName ?? 'Anonymous'}
                      </p>
                      {session.completedAt && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(session.completedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {session.percentage !== undefined && session.percentage !== null ? (
                        <span className="text-sm font-medium">
                          {Math.round(session.percentage)}%
                        </span>
                      ) : null}
                      <Badge
                        variant={session.status === 'completed' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {session.status}
                      </Badge>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
