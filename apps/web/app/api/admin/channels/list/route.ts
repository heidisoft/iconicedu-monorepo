import { NextResponse } from 'next/server';

import { getAdminChannelRows } from '@iconicedu/web/lib/admin/channels';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

const PAGE_SIZE = 10;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orgSlug = url.searchParams.get('orgSlug')?.trim() ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const search = url.searchParams.get('search')?.trim() ?? '';
  const kind = url.searchParams.get('kind') ?? 'all';

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

    const allRows = await getAdminChannelRows(org.id);

    const normalizedSearch = search.toLowerCase();
    const filtered = allRows.filter((row) => {
      if (kind !== 'all' && row.kind !== kind) return false;
      if (!normalizedSearch) return true;
      return (
        (row.topic?.toLowerCase().includes(normalizedSearch) ?? false) ||
        (row.purpose?.toLowerCase().includes(normalizedSearch) ?? false) ||
        (row.kind?.toLowerCase().includes(normalizedSearch) ?? false)
      );
    });

    const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
    filtered.sort((a, b) => collator.compare(a.topic, b.topic));

    const total = filtered.length;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return NextResponse.json({ success: true, rows, total, pageCount });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load channels',
      },
      { status: 500 },
    );
  }
}
