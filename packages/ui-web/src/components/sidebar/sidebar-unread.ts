import type { ChannelVM } from '@iconicedu/shared-types';

export function getDirectMessageUnreadCount(directMessages: ChannelVM[]): number {
  return directMessages.reduce((total, channel) => {
    return total + Math.max(0, channel.collections.readState?.unreadCount ?? 0);
  }, 0);
}
