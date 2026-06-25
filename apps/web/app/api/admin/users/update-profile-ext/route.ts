import { NextResponse } from 'next/server';

import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';
import { getFamilyInviteAdminClient } from '@iconicedu/web/lib/family/queries/invite.query';

type UpdateProfileExtBody = {
  accountId?: string;
  profileId?: string;
  orgId?: string;
  kind?: string;
  // child
  birthYear?: number | null;
  schoolName?: string | null;
  schoolYear?: string | null;
  interests?: string[] | null;
  strengths?: string[] | null;
  learningPreferences?: string[] | null;
  confidenceLevel?: string | null;
  // educator
  headline?: string | null;
  bio?: string | null;
  education?: string | null;
  experienceYears?: number | null;
  // staff
  jobTitle?: string | null;
  department?: string | null;
};

function nullIfEmpty(value?: string | null): string | null {
  const t = value?.trim() ?? '';
  return t || null;
}

export async function POST(request: Request) {
  const body = (await request.json()) as UpdateProfileExtBody;
  const { accountId, profileId, orgId, kind } = body;

  if (!accountId || !profileId || !orgId || !kind) {
    return NextResponse.json(
      { success: false, message: 'accountId, profileId, orgId, and kind are required' },
      { status: 400 },
    );
  }

  const authContext = await requireAdminOrgContext(orgId, { allowStaff: true });
  if (!authContext.ok) {
    return NextResponse.json(
      { success: false, message: authContext.message },
      { status: authContext.status },
    );
  }

  const adminClient = getFamilyInviteAdminClient();

  if (kind === 'child') {
    const { error } = await adminClient
      .from('child_profiles')
      .upsert(
        {
          profile_id: profileId,
          org_id: orgId,
          birth_year: body.birthYear ?? null,
          school_name: nullIfEmpty(body.schoolName),
          school_year: nullIfEmpty(body.schoolYear),
          interests: body.interests ?? null,
          strengths: body.strengths ?? null,
          learning_preferences: body.learningPreferences ?? null,
          confidence_level: nullIfEmpty(body.confidenceLevel),
        },
        { onConflict: 'profile_id' },
      )
      .eq('org_id', orgId);

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 },
      );
    }
  } else if (kind === 'educator') {
    const { error } = await adminClient
      .from('educator_profiles')
      .upsert(
        {
          profile_id: profileId,
          org_id: orgId,
          headline: nullIfEmpty(body.headline),
          education: nullIfEmpty(body.education),
          experience_years: body.experienceYears ?? null,
        },
        { onConflict: 'profile_id' },
      )
      .eq('org_id', orgId);

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 },
      );
    }

    if (nullIfEmpty(body.bio) !== undefined) {
      await adminClient
        .from('profiles')
        .update({ bio: nullIfEmpty(body.bio) })
        .eq('id', profileId)
        .eq('org_id', orgId);
    }
  } else if (kind === 'staff') {
    const { error } = await adminClient
      .from('staff_profiles')
      .upsert(
        {
          profile_id: profileId,
          org_id: orgId,
          job_title: nullIfEmpty(body.jobTitle),
          department: nullIfEmpty(body.department),
        },
        { onConflict: 'profile_id' },
      )
      .eq('org_id', orgId);

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ success: true });
}
