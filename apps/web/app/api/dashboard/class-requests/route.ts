import { NextResponse } from 'next/server';
import { sendTextMessageAction } from '@iconicedu/web/app/actions/messages';

import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import {
  buildDashboardClassRequestMessage,
  createPrivateClassRequestChannel,
  listClassRequestRecipientProfiles,
  type DashboardClassRequestPayload,
} from '@iconicedu/web/lib/dashboard/class-request';
import { resolveEffectiveProfileForAuthUserInOrg } from '@iconicedu/web/lib/family-view/effective-profile';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { buildUserProfileById } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import { getProfilesByIds } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { listActiveOrgSubjectCatalog } from '@iconicedu/web/lib/subjects/queries/org-subject-catalog.query';
import { isClassRequestIntent, OTHER_SUBJECT_OPTION } from '@iconicedu/shared-types';

const OTHER_SUBJECT = OTHER_SUBJECT_OPTION;

function parsePayload(body: unknown): DashboardClassRequestPayload | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const payload = body as Record<string, unknown>;
  const orgSlug = typeof payload.orgSlug === 'string' ? payload.orgSlug.trim() : '';
  const requestIntent = payload.requestIntent;
  const studentProfileIds = Array.isArray(payload.studentProfileIds)
    ? payload.studentProfileIds.filter((id): id is string => typeof id === 'string')
    : [];
  const subjects = Array.isArray(payload.subjects)
    ? payload.subjects.filter((subject): subject is string => typeof subject === 'string')
    : [];
  const otherSubject =
    typeof payload.otherSubject === 'string' ? payload.otherSubject.trim() : null;
  const learningGoals =
    typeof payload.learningGoals === 'string' ? payload.learningGoals.trim() : '';
  const specialRequirements =
    typeof payload.specialRequirements === 'string'
      ? payload.specialRequirements.trim()
      : null;

  if (
    !orgSlug ||
    !isClassRequestIntent(requestIntent) ||
    !studentProfileIds.length ||
    !subjects.length
  ) {
    return null;
  }

  return {
    orgSlug,
    requestIntent,
    studentProfileIds,
    subjects,
    otherSubject,
    learningGoals,
    specialRequirements,
  };
}

export async function POST(request: Request) {
  const payload = parsePayload(await request.json());

  if (!payload) {
    return NextResponse.json(
      { success: false, message: 'Invalid request payload.' },
      { status: 400 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const serviceSupabase = createSupabaseServiceClient();
    const authUser = await requireAuthedUser(supabase);
    const org = await buildOrgBySlug(supabase, payload.orgSlug);

    if (!org) {
      return NextResponse.json(
        { success: false, message: 'Organization not found.' },
        { status: 404 },
      );
    }

    const subjectCatalogResponse = await listActiveOrgSubjectCatalog(
      serviceSupabase,
      org.id,
    );
    if (subjectCatalogResponse.error) {
      return NextResponse.json(
        { success: false, message: subjectCatalogResponse.error.message },
        { status: 500 },
      );
    }

    const allowedSubjects = new Set(
      (subjectCatalogResponse.data ?? []).map((row) => row.subject).concat(OTHER_SUBJECT),
    );
    if (payload.subjects.some((subject) => !allowedSubjects.has(subject))) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid subject selection.',
        },
        { status: 400 },
      );
    }

    if (payload.subjects.includes(OTHER_SUBJECT) && !payload.otherSubject?.length) {
      return NextResponse.json(
        {
          success: false,
          message: 'Other subject is required when selecting Other.',
        },
        { status: 400 },
      );
    }

    const resolution = await resolveEffectiveProfileForAuthUserInOrg(supabase, {
      authUserId: authUser.id,
      orgId: org.id,
    });
    const requesterProfile = resolution.effectiveProfile;
    if (requesterProfile.kind !== 'guardian' && requesterProfile.kind !== 'child') {
      return NextResponse.json(
        { success: false, message: 'Only parents and students can submit requests.' },
        { status: 403 },
      );
    }

    const requesterVM = await buildUserProfileById(supabase, requesterProfile.id);
    if (!requesterVM) {
      return NextResponse.json(
        { success: false, message: 'Unable to load profile.' },
        { status: 404 },
      );
    }

    const allowedStudentIds =
      requesterVM.kind === 'child'
        ? new Set([requesterVM.ids.id])
        : requesterVM.kind === 'guardian'
          ? new Set((requesterVM.children?.items ?? []).map((child) => child.ids.id))
          : new Set<string>();

    const selectedStudentIds = Array.from(
      new Set(payload.studentProfileIds.filter((id) => allowedStudentIds.has(id))),
    );

    if (!selectedStudentIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: 'Select at least one valid student.',
        },
        { status: 400 },
      );
    }

    const selectedStudentsResponse = await getProfilesByIds(
      supabase,
      org.id,
      selectedStudentIds,
    );

    const selectedStudents = selectedStudentsResponse.data ?? [];
    if (!selectedStudents.length) {
      return NextResponse.json(
        {
          success: false,
          message: 'Unable to resolve selected students.',
        },
        { status: 400 },
      );
    }

    const staffProfiles = await listClassRequestRecipientProfiles({
      supabase: serviceSupabase,
      orgId: org.id,
    });

    const now = new Date();
    const nowIso = now.toISOString();
    const requesterName = requesterProfile.display_name?.trim() || 'Requester';
    const topic = `Class Requests · ${requesterName}`;

    const { channelId } = await createPrivateClassRequestChannel({
      supabase: serviceSupabase,
      orgId: org.id,
      requesterProfile,
      staffProfiles,
      topic,
      nowIso,
    });

    const messageText = buildDashboardClassRequestMessage({
      requesterName: requesterProfile.display_name?.trim() || 'Unknown requester',
      requestIntent: payload.requestIntent,
      studentNames: selectedStudents
        .map((student) => student.display_name?.trim())
        .filter((name): name is string => Boolean(name)),
      subjects: payload.subjects,
      otherSubject: payload.otherSubject,
      learningGoals: payload.learningGoals,
      specialRequirements: payload.specialRequirements,
    });

    await sendTextMessageAction({
      orgId: org.id,
      channelId,
      senderProfileId: requesterProfile.id,
      content: messageText,
    });

    return NextResponse.json({
      success: true,
      channelId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
