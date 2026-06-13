import type { ChannelVM, UserProfileVM } from '@iconicedu/shared-types';

export function isStaffObserverReadOnlyChannel(
  _channel: ChannelVM,
  _accountId: string,
  _profile?: UserProfileVM | null,
): boolean {
  return false;
}
