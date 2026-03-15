import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrgSubjectCatalogRow } from '@iconicedu/shared-types';
import { STANDARD_SUBJECT_OPTIONS } from '@iconicedu/shared-types';

import {
  normalizeSubjectKey,
  normalizeSubjectLabel,
} from '@iconicedu/web/lib/subjects/utils';

const ORG_SUBJECT_CATALOG_SELECT = [
  'id',
  'org_id',
  'subject',
  'subject_key',
  'is_active',
  'sort_order',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'deleted_at',
  'deleted_by',
].join(', ');

export async function listOrgSubjectCatalog(supabase: SupabaseClient, orgId: string) {
  return supabase
    .from('org_subject_catalog')
    .select(ORG_SUBJECT_CATALOG_SELECT)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('subject', { ascending: true })
    .returns<OrgSubjectCatalogRow[]>();
}

export async function listActiveOrgSubjectCatalog(
  supabase: SupabaseClient,
  orgId: string,
) {
  return supabase
    .from('org_subject_catalog')
    .select(ORG_SUBJECT_CATALOG_SELECT)
    .eq('org_id', orgId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('subject', { ascending: true })
    .returns<OrgSubjectCatalogRow[]>();
}

export function mapOrgSubjectRowsToOptions(rows?: OrgSubjectCatalogRow[] | null) {
  const labels = (rows ?? [])
    .map((row) => normalizeSubjectLabel(row.subject))
    .filter(Boolean);

  return labels.length ? labels : [...STANDARD_SUBJECT_OPTIONS];
}

export async function seedDefaultOrgSubjectCatalog(input: {
  supabase: SupabaseClient;
  orgId: string;
  actorId?: string | null;
  extraSubjects?: string[];
}) {
  const defaults = [...STANDARD_SUBJECT_OPTIONS, ...(input.extraSubjects ?? [])];
  const uniqueSubjects = Array.from(
    new Map(
      defaults
        .map((subject) => normalizeSubjectLabel(subject))
        .filter(Boolean)
        .map((subject) => [normalizeSubjectKey(subject), subject]),
    ).values(),
  );

  if (!uniqueSubjects.length) {
    return { error: null };
  }

  return input.supabase.from('org_subject_catalog').upsert(
    uniqueSubjects.map((subject, index) => ({
      org_id: input.orgId,
      subject,
      subject_key: normalizeSubjectKey(subject),
      is_active: true,
      sort_order: (index + 1) * 10,
      created_by: input.actorId ?? null,
      updated_by: input.actorId ?? null,
      deleted_at: null,
      deleted_by: null,
    })),
    { onConflict: 'org_id,subject_key', ignoreDuplicates: false },
  );
}
