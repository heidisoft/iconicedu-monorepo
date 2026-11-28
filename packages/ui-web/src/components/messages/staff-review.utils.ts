import type { ChannelVM, MessageVM } from '@iconicedu/shared-types';
import { isOutsideMessageAudience } from '@iconicedu/utils';

/**
 * Database policies let staff read every private channel message so they can
 * review it, independent of the rollout flag. The API list only returns those
 * messages while staff review is enabled, so live updates must apply the same
 * gate; otherwise a private message would flash in and vanish on refresh.
 *
 * Support channels keep their own audience model (staff always see support
 * conversations), and only ordinary channels have chosen audiences.
 */
export function isHiddenStaffReviewMessage(input: {
  message: MessageVM;
  channel: Pick<ChannelVM, 'basics'>;
  viewerProfileId?: string | null;
  enableStaffMessageReview: boolean;
}): boolean {
  if (input.enableStaffMessageReview) return false;
  if (input.channel.basics.kind !== 'channel') return false;
  if (input.channel.basics.purpose === 'support') return false;
  return isOutsideMessageAudience({
    visibility: input.message.core.visibility,
    senderProfileId: input.message.core.sender.ids.id,
    viewerProfileId: input.viewerProfileId,
  });
}
