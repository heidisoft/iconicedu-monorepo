import { NextResponse } from 'next/server';

import { getAdminUserRowsPaginated } from '@iconicedu/web/lib/admin/users';
import {
  AdminOrgContextError,
  requireAdminOrgContext,
} from '@iconicedu/web/lib/admin/require-admin-org-context';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

const PAGE_SIZE = 10;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orgSlug = url.searchParams.get('orgSlug')?.trim() ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const search = url.searchParams.get('search')?.trim() ?? '';
  const status = url.searchParams.get('status') ?? 'all';
  const role = url.searchParams.get('role') ?? 'all';
  const sortByRaw = url.searchParams.get('sortBy') ?? 'recently_active';
  const sortBy = sortByRaw === 'created' ? 'created' : 'recently_active';

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

    const { rows, total, pageCount } = await getAdminUserRowsPaginated(org.id, {
      page,
      pageSize: PAGE_SIZE,
      search,
      status,
      role,
      sortBy,
    });

    return NextResponse.json({ success: true, rows, total, pageCount });
  } catch (error) {
    if (error instanceof AdminOrgContextError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load users',
      },
      { status: 500 },
    );
  }
}
