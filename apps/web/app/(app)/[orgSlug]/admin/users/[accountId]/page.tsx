import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import { DashboardHeader, Button, Badge } from '@iconicedu/ui-web';

import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { getAdminUserProfilePreview } from '@iconicedu/web/lib/admin/user-profile-preview';
import { getChildProfile } from '@iconicedu/web/lib/profile/queries/child.query';
import { getEducatorProfile } from '@iconicedu/web/lib/profile/queries/educator.query';
import { getStaffProfile } from '@iconicedu/web/lib/profile/queries/staff.query';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { UserEditForm } from '@iconicedu/web/app/(app)/[orgSlug]/admin/users/[accountId]/user-edit-form';
import type { UserEditInitialData } from '@iconicedu/web/app/(app)/[orgSlug]/admin/users/[accountId]/user-edit-form';

export const metadata: Metadata = { title: 'Admin · Edit User' };

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ orgSlug: string; accountId: string }>;
}) {
  const { orgSlug, accountId } = await params;
  const { account: dashboardAccount } = await getDashboardAccountContext(orgSlug);

  const preview = await getAdminUserProfilePreview(accountId, {
    orgId: dashboardAccount.org_id,
  });
  if (!preview) notFound();

  const { account, profile } = preview;
  if (!account) notFound();

  const supabase = createSupabaseServiceClient();
  const profileId = profile?.ids.id ?? null;
  const orgId = account.ids.orgId;
  const kind = profile?.kind ?? null;

  const { data: rawAccount } = await supabase
    .from('accounts')
    .select('primary_role, role_status, email')
    .eq('id', accountId)
    .is('deleted_at', null)
    .maybeSingle<{
      primary_role: string | null;
      role_status: string | null;
      email: string | null;
    }>();

  const [childExt, educatorExt, staffExt] = await Promise.all([
    kind === 'child' && profileId
      ? getChildProfile(supabase, profileId).then((r) => r.data)
      : Promise.resolve(null),
    kind === 'educator' && profileId
      ? getEducatorProfile(supabase, profileId).then((r) => r.data)
      : Promise.resolve(null),
    kind === 'staff' && profileId
      ? getStaffProfile(supabase, profileId).then((r) => r.data)
      : Promise.resolve(null),
  ]);

  const accountEmail = rawAccount?.email ?? account.contacts.email ?? '';
  const displayName = profile?.profile.displayName ?? (accountEmail || 'Unknown User');

  const initialData: UserEditInitialData = {
    accountId,
    profileId,
    orgId,
    kind,
    email: accountEmail,
    displayName: profile?.profile.displayName ?? '',
    firstName: profile?.profile.firstName ?? '',
    lastName: profile?.profile.lastName ?? '',
    bio: profile?.kind !== 'child' ? (profile?.profile.bio ?? '') : '',
    primaryRole: rawAccount?.primary_role ?? 'unassigned',
    roleStatus: rawAccount?.role_status ?? 'unassigned',
    timezone: profile?.prefs.timezone ?? '',
    countryName: profile?.location?.countryName ?? '',
    // child-specific
    birthYear: childExt?.birth_year ?? null,
    schoolName: childExt?.school_name ?? '',
    schoolYear: childExt?.school_year ?? '',
    interests: childExt?.interests ?? [],
    strengths: childExt?.strengths ?? [],
    learningPreferences: childExt?.learning_preferences ?? [],
    confidenceLevel: childExt?.confidence_level ?? '',
    // guardian info for child rows
    guardianNames: profile?.kind === 'child' ? (profile.guardianNames ?? []) : [],
    // educator-specific
    headline: educatorExt?.headline ?? '',
    education: educatorExt?.education ?? '',
    experienceYears: educatorExt?.experience_years ?? null,
    // staff-specific
    jobTitle: staffExt?.job_title ?? '',
    department: staffExt?.department ?? '',
    // guardian: linked children
    linkedChildNames:
      profile?.kind === 'guardian'
        ? (profile.children?.items?.map((c) => c.profile.displayName) ?? [])
        : [],
  };

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Edit User" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-8 max-w-3xl">
        <div className="flex flex-col gap-4">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit text-muted-foreground"
          >
            <Link href={`/${orgSlug}/admin/users`}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Users
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
              <Badge variant="secondary" className="gap-1 shrink-0">
                <Pencil className="h-3 w-3" /> Editing
              </Badge>
              {kind && (
                <Badge variant="outline" className="shrink-0 capitalize">
                  {kind}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{accountEmail}</p>
          </div>
        </div>

        <UserEditForm orgSlug={orgSlug} initialData={initialData} />
      </div>
    </div>
  );
}
