import { requireAdminAuthContext } from '@iconicedu/web/lib/admin/_auth-context';

type ArchivableTable = 'learning_spaces' | 'channels';
type EntityStatus = 'active' | 'archived';

export async function setEntityStatus(
  table: ArchivableTable,
  entityId: string,
  status: EntityStatus,
) {
  const { supabase, orgId, profileId, now } = await requireAdminAuthContext();

  const { error } = await supabase
    .from(table)
    .update(
      status === 'archived'
        ? {
            status,
            archived_at: now,
            updated_at: now,
            updated_by: profileId,
          }
        : {
            status,
            archived_at: null,
            updated_at: now,
            updated_by: profileId,
          },
    )
    .eq('org_id', orgId)
    .eq('id', entityId)
    .is('deleted_at', null);

  if (error) {
    throw new Error(error.message);
  }
}
