import type { ChannelVM, UserProfileVM } from '@iconicedu/shared-types';

export function isStaffObserverReadOnlyChannel(
  channel: ChannelVM,
  accountId: string,
  profile?: UserProfileVM | null,
): boolean {
  if (profile?.kind !== 'staff') {
    return false;
  }
  const channelPurpose =
    (
      channel as unknown as {
        basics?: { purpose?: string | null };
        settings?: { purpose?: string | null };
      }
    ).basics?.purpose ??
    (channel as unknown as { settings?: { purpose?: string | null } }).settings
      ?.purpose ??
    null;
  if (channelPurpose === 'support') {
    return false;
  }
  return !channel.collections.participants.some(
    (participant) => participant.ids.accountId === accountId,
  );
}
