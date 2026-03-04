import { setEntityStatus } from '@iconicedu/web/lib/admin/entity-status';

export async function unarchiveChannel(channelId: string) {
  await setEntityStatus('channels', channelId, 'active');
}
