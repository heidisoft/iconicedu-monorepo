import type { ChannelVM, UserProfileVM } from '@iconicedu/shared-types';

export function isStaffObserverReadOnlyChannel(
  channel: ChannelVM,
  accountId: string,
  profile?: UserProfileVM | null,
): boolean {
  if (profile?.kind !== 'staff') {
    return false;
  }
  return !channel.collections.participants.some(
    (participant) => participant.ids.accountId === accountId,
  );
}
