import { NextResponse } from 'next/server';

import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import {
  buildDashboardClassRequestMessage,
  createPrivateClassRequestChannel,
  DASHBOARD_CLASS_REQUEST_SUBJECT_OPTIONS,
  type DashboardClassRequestPayload,
} from '@iconicedu/web/lib/dashboard/class-request';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { buildUserProfileById } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import {
  getProfileByAccountId,
  getProfilesByIds,
  getProfilesByKind,
} from '@iconicedu/web/lib/profile/queries/profiles.query';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

const OTHER_SUBJECT = 'Other';
type AllowedDashboardSubject = (typeof DASHBOARD_CLASS_REQUEST_SUBJECT_OPTIONS)[number];

function parsePayload(body: unknown): DashboardClassRequestPayload | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const payload = body as Record<string, unknown>;
  const orgSlug = typeof payload.orgSlug === 'string' ? payload.orgSlug.trim() : '';
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

  if (!orgSlug || !studentProfileIds.length || !subjects.length) {
    return null;
  }

  return {
    orgSlug,
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

  const allowedSubjects = new Set<AllowedDashboardSubject>(
    DASHBOARD_CLASS_REQUEST_SUBJECT_OPTIONS,
  );
  const isAllowedSubject = (subject: string): subject is AllowedDashboardSubject =>
    allowedSubjects.has(subject as AllowedDashboardSubject);

  if (payload.subjects.some((subject) => !isAllowedSubject(subject))) {
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

    const accountResponse = await getAccountByAuthUserId(supabase, authUser.id);
    if (!accountResponse.data || accountResponse.data.org_id !== org.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized.' },
        { status: 403 },
      );
    }

    const requesterProfileResponse = await getProfileByAccountId(
      supabase,
      accountResponse.data.id,
    );

    if (!requesterProfileResponse.data) {
      return NextResponse.json(
        { success: false, message: 'Profile not found.' },
        { status: 404 },
      );
    }

    const requesterProfile = requesterProfileResponse.data;
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

    const staffProfilesResponse = await getProfilesByKind(supabase, org.id, 'staff');
    const staffProfiles = staffProfilesResponse.data ?? [];

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
      studentNames: selectedStudents
        .map((student) => student.display_name?.trim())
        .filter((name): name is string => Boolean(name)),
      subjects: payload.subjects,
      otherSubject: payload.otherSubject,
      learningGoals: payload.learningGoals,
      specialRequirements: payload.specialRequirements,
    });

    const messageInsert = await serviceSupabase
      .from('messages')
      .insert({
        org_id: org.id,
        channel_id: channelId,
        sender_profile_id: requesterProfile.id,
        type: 'text',
        visibility_type: 'all',
        thread_id: null,
        thread_parent_id: null,
        created_at: nowIso,
        created_by: requesterProfile.id,
        updated_at: nowIso,
        updated_by: requesterProfile.id,
      })
      .select('id')
      .single<{ id: string }>();

    if (messageInsert.error || !messageInsert.data?.id) {
      throw new Error(
        messageInsert.error?.message ?? 'Unable to create request message.',
      );
    }

    const messagePayloadInsert = await serviceSupabase.from('message_text').insert({
      message_id: messageInsert.data.id,
      org_id: org.id,
      payload: {
        text: messageText,
      },
      created_at: nowIso,
      created_by: requesterProfile.id,
      updated_at: nowIso,
      updated_by: requesterProfile.id,
    });

    if (messagePayloadInsert.error) {
      throw new Error(messagePayloadInsert.error.message);
    }

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
