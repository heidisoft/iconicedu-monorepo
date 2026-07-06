import { NextResponse } from 'next/server';

import { getAdminLearningSpaceRows } from '@iconicedu/web/lib/admin/learning-spaces';
import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

const PAGE_SIZE = 10;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orgSlug = url.searchParams.get('orgSlug')?.trim() ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const search = url.searchParams.get('search')?.trim() ?? '';
  const status = url.searchParams.get('status') ?? 'all';
  const participantId = url.searchParams.get('participantId') ?? 'all';

  if (!orgSlug) {
    return NextResponse.json(
      { success: false, message: 'orgSlug is required' },
      { status: 400 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const org = await buildOrgBySlug(supabase, orgSlug);

    if (!org) {
      return NextResponse.json(
        { success: false, message: 'Org not found' },
        { status: 404 },
      );
    }

    const authContext = await requireAdminOrgContext(org.id);
    if (!authContext.ok) {
      return NextResponse.json(
        { success: false, message: authContext.message },
        { status: authContext.status },
      );
    }

    const allRows = await getAdminLearningSpaceRows(org.id);

    const normalizedSearch = search.toLowerCase();
    const filtered = allRows.filter((row) => {
      if (status !== 'all' && row.status !== status) return false;
      if (
        participantId !== 'all' &&
        !row.participantDetails.some((p) => p.id === participantId)
      )
        return false;
      if (!normalizedSearch) return true;
      return (
        row.title.toLowerCase().includes(normalizedSearch) ||
        (row.subject?.toLowerCase().includes(normalizedSearch) ?? false) ||
        (row.description?.toLowerCase().includes(normalizedSearch) ?? false)
      );
    });

    filtered.sort((a, b) => {
      const tA = new Date(a.updated_at ?? a.created_at).getTime();
      const tB = new Date(b.updated_at ?? b.created_at).getTime();
      if (tA !== tB) return tB - tA;
      return a.title.localeCompare(b.title, 'en', { sensitivity: 'base', numeric: true });
    });

    const total = filtered.length;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return NextResponse.json({ success: true, rows, total, pageCount });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load classrooms',
      },
      { status: 500 },
    );
  }
}
