import { NextResponse } from 'next/server';
import type {
  CreateOrgSubjectCatalogItemInput,
  OrgSubjectCatalogItemVM,
  OrgSubjectCatalogRow,
  OrgSubjectCatalogSnapshotVM,
  UpdateOrgSubjectCatalogItemInput,
} from '@iconicedu/shared-types';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';
import {
  normalizeSubjectKey,
  normalizeSubjectLabel,
} from '@iconicedu/web/lib/subjects/utils';
import { listOrgSubjectCatalog } from '@iconicedu/web/lib/subjects/queries/org-subject-catalog.query';

function parseSubjectCounts(rows: Array<{ subject: string | null }>) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    if (!row.subject) {
      return;
    }
    const key = normalizeSubjectKey(row.subject);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

function toCatalogItemVm(
  row: OrgSubjectCatalogRow,
  learningSpaceCounts: Map<string, number>,
  educatorCounts: Map<string, number>,
): OrgSubjectCatalogItemVM {
  const learningSpaceCount = learningSpaceCounts.get(row.subject_key) ?? 0;
  const educatorProfileCount = educatorCounts.get(row.subject_key) ?? 0;

  return {
    id: row.id,
    orgId: row.org_id,
    subject: row.subject,
    subjectKey: row.subject_key,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    learningSpaceCount,
    educatorProfileCount,
    usageCount: learningSpaceCount + educatorProfileCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function buildSubjectCatalogSnapshot(
  orgId: string,
): Promise<{ data?: OrgSubjectCatalogSnapshotVM; error?: string }> {
  const serviceSupabase = createSupabaseServiceClient();
  const [catalogResponse, learningSpacesResponse, educatorSubjectsResponse] =
    await Promise.all([
      listOrgSubjectCatalog(serviceSupabase, orgId),
      serviceSupabase
        .from('learning_spaces')
        .select('subject')
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .returns<Array<{ subject: string | null }>>(),
      serviceSupabase
        .from('educator_profile_subjects')
        .select('subject')
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .returns<Array<{ subject: string | null }>>(),
    ]);

  if (catalogResponse.error) {
    return { error: catalogResponse.error.message };
  }
  if (learningSpacesResponse.error) {
    return { error: learningSpacesResponse.error.message };
  }
  if (educatorSubjectsResponse.error) {
    return { error: educatorSubjectsResponse.error.message };
  }

  const learningSpaceCounts = parseSubjectCounts(learningSpacesResponse.data ?? []);
  const educatorCounts = parseSubjectCounts(educatorSubjectsResponse.data ?? []);

  return {
    data: {
      items: (catalogResponse.data ?? []).map((row) =>
        toCatalogItemVm(row, learningSpaceCounts, educatorCounts),
      ),
    },
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId');

  if (!orgId) {
    return NextResponse.json(
      { success: false, message: 'orgId is required' },
      { status: 400 },
    );
  }

  try {
    const authContext = await requireAdminOrgContext(orgId);
    if (!authContext.ok) {
      return NextResponse.json(
        { success: false, message: authContext.message },
        { status: authContext.status },
      );
    }

    const snapshot = await buildSubjectCatalogSnapshot(orgId);
    if (snapshot.error) {
      return NextResponse.json(
        { success: false, message: snapshot.error },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: snapshot.data });
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

export async function POST(request: Request) {
  const payload = (await request.json()) as CreateOrgSubjectCatalogItemInput;
  const orgId = payload.orgId;
  const subject =
    typeof payload.subject === 'string' ? normalizeSubjectLabel(payload.subject) : '';
  const subjectKey =
    typeof payload.subjectKey === 'string'
      ? normalizeSubjectKey(payload.subjectKey)
      : normalizeSubjectKey(subject);

  if (!orgId || !subject || !subjectKey) {
    return NextResponse.json(
      { success: false, message: 'Missing required fields.' },
      { status: 400 },
    );
  }

  try {
    const authContext = await requireAdminOrgContext(orgId);
    if (!authContext.ok) {
      return NextResponse.json(
        { success: false, message: authContext.message },
        { status: authContext.status },
      );
    }

    const serviceSupabase = createSupabaseServiceClient();
    const existingResponse = await serviceSupabase
      .from('org_subject_catalog')
      .select('id, sort_order, is_active')
      .eq('org_id', orgId)
      .eq('subject_key', subjectKey)
      .is('deleted_at', null)
      .maybeSingle<{ id: string; sort_order: number; is_active: boolean }>();

    if (existingResponse.error) {
      return NextResponse.json(
        { success: false, message: existingResponse.error.message },
        { status: 500 },
      );
    }

    if (existingResponse.data) {
      const updateResponse = await serviceSupabase
        .from('org_subject_catalog')
        .update({
          subject,
          is_active: true,
          updated_by: authContext.actorProfileId,
          deleted_at: null,
          deleted_by: null,
        })
        .eq('id', existingResponse.data.id);

      if (updateResponse.error) {
        return NextResponse.json(
          { success: false, message: updateResponse.error.message },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true });
    }

    const sortResponse = await serviceSupabase
      .from('org_subject_catalog')
      .select('sort_order')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: false })
      .limit(1)
      .returns<Array<{ sort_order: number }>>();

    if (sortResponse.error) {
      return NextResponse.json(
        { success: false, message: sortResponse.error.message },
        { status: 500 },
      );
    }

    const nextSortOrder = (sortResponse.data?.[0]?.sort_order ?? 0) + 10;
    const insertResponse = await serviceSupabase.from('org_subject_catalog').insert({
      org_id: orgId,
      subject,
      subject_key: subjectKey,
      is_active: true,
      sort_order: nextSortOrder,
      created_by: authContext.actorProfileId,
      updated_by: authContext.actorProfileId,
    });

    if (insertResponse.error) {
      return NextResponse.json(
        { success: false, message: insertResponse.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
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

export async function PATCH(request: Request) {
  const payload = (await request.json()) as UpdateOrgSubjectCatalogItemInput;
  const nextSubject =
    typeof payload.subject === 'string' ? normalizeSubjectLabel(payload.subject) : null;
  const nextSubjectKey =
    typeof payload.subjectKey === 'string'
      ? normalizeSubjectKey(payload.subjectKey)
      : nextSubject
        ? normalizeSubjectKey(nextSubject)
        : null;

  if (
    !payload.orgId ||
    !payload.subjectId ||
    (typeof payload.isActive !== 'boolean' && !nextSubject && !nextSubjectKey)
  ) {
    return NextResponse.json(
      { success: false, message: 'Missing required fields.' },
      { status: 400 },
    );
  }

  try {
    const authContext = await requireAdminOrgContext(payload.orgId);
    if (!authContext.ok) {
      return NextResponse.json(
        { success: false, message: authContext.message },
        { status: authContext.status },
      );
    }

    const serviceSupabase = createSupabaseServiceClient();
    const currentSubjectResponse = await serviceSupabase
      .from('org_subject_catalog')
      .select('id, subject, subject_key, is_active')
      .eq('org_id', payload.orgId)
      .eq('id', payload.subjectId)
      .is('deleted_at', null)
      .maybeSingle<{
        id: string;
        subject: string;
        subject_key: string;
        is_active: boolean;
      }>();

    if (currentSubjectResponse.error || !currentSubjectResponse.data) {
      return NextResponse.json(
        {
          success: false,
          message: currentSubjectResponse.error?.message ?? 'Subject not found.',
        },
        { status: currentSubjectResponse.error ? 500 : 404 },
      );
    }

    const currentSubject = currentSubjectResponse.data;
    const updatePayload: Record<string, unknown> = {
      updated_by: authContext.actorProfileId,
    };

    if (typeof payload.isActive === 'boolean') {
      updatePayload.is_active = payload.isActive;
    }

    if (nextSubject) {
      updatePayload.subject = nextSubject;
    }

    if (nextSubjectKey) {
      const duplicateSubjectResponse = await serviceSupabase
        .from('org_subject_catalog')
        .select('id')
        .eq('org_id', payload.orgId)
        .eq('subject_key', nextSubjectKey)
        .is('deleted_at', null)
        .neq('id', payload.subjectId)
        .maybeSingle<{ id: string }>();

      if (duplicateSubjectResponse.error) {
        return NextResponse.json(
          { success: false, message: duplicateSubjectResponse.error.message },
          { status: 500 },
        );
      }

      if (duplicateSubjectResponse.data) {
        return NextResponse.json(
          { success: false, message: 'A subject with that key already exists.' },
          { status: 409 },
        );
      }

      updatePayload.subject_key = nextSubjectKey;
    }

    const updateResponse = await serviceSupabase
      .from('org_subject_catalog')
      .update(updatePayload)
      .eq('org_id', payload.orgId)
      .eq('id', payload.subjectId)
      .is('deleted_at', null);

    if (updateResponse.error) {
      return NextResponse.json(
        { success: false, message: updateResponse.error.message },
        { status: 500 },
      );
    }

    if (nextSubject && nextSubject !== currentSubject.subject) {
      const learningSpacesUpdateResponse = await serviceSupabase
        .from('learning_spaces')
        .update({
          subject: nextSubject,
          updated_by: authContext.actorProfileId,
        })
        .eq('org_id', payload.orgId)
        .eq('subject', currentSubject.subject)
        .is('deleted_at', null);

      if (learningSpacesUpdateResponse.error) {
        return NextResponse.json(
          { success: false, message: learningSpacesUpdateResponse.error.message },
          { status: 500 },
        );
      }

      const educatorSubjectsUpdateResponse = await serviceSupabase
        .from('educator_profile_subjects')
        .update({
          subject: nextSubject,
          updated_by: authContext.actorProfileId,
        })
        .eq('org_id', payload.orgId)
        .eq('subject', currentSubject.subject)
        .is('deleted_at', null);

      if (educatorSubjectsUpdateResponse.error) {
        return NextResponse.json(
          { success: false, message: educatorSubjectsUpdateResponse.error.message },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true });
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
