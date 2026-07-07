import { NextResponse } from 'next/server';

import { getAdminFamilyRows } from '@iconicedu/web/lib/admin/families';
import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

const PAGE_SIZE = 10;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orgSlug = url.searchParams.get('orgSlug')?.trim() ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const search = url.searchParams.get('search')?.trim() ?? '';
  const invites = url.searchParams.get('invites') ?? 'all';

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

    const allRows = await getAdminFamilyRows(org.id);

    const normalizedSearch = search.toLowerCase();
    const filtered = allRows.filter((row) => {
      if (invites === 'with-invites' && row.pendingInvites.length === 0) return false;
      if (invites === 'without-invites' && row.pendingInvites.length > 0) return false;
      if (!normalizedSearch) return true;
      const haystack = [
        row.displayName,
        ...row.guardians.map((g) => g.label),
        ...row.children.map((c) => c.label),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });

    const total = filtered.length;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return NextResponse.json({ success: true, rows, total, pageCount });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load families',
      },
      { status: 500 },
    );
  }
}
