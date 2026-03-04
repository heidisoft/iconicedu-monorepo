import { setEntityStatus } from '@iconicedu/web/lib/admin/entity-status';

export async function archiveChannel(channelId: string) {
  await setEntityStatus('channels', channelId, 'archived');
}
