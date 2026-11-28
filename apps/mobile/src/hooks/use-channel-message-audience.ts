import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MessageVM } from '@iconicedu/shared-types';
import { isOutsideMessageAudience } from '@iconicedu/utils';
import { fetchChannelMembers } from '@/lib/api/queries';
import { getMentionCandidates } from '@/lib/messages/message-mentions';
import { useMobileFeatureFlag } from '@/hooks/use-mobile-feature-flag';
import { mobileFeatureFlagKeys } from '@/lib/feature-flags';

/**
 * Private-message setup shared by the channel and classroom screens: who can
 * pick an audience, the members that power the picker / badge names /
 * @mentions, and whether a message is visible to the viewer only through
 * read-only staff review.
 */
export function useChannelMessageAudience(input: {
  orgId: string;
  channelId: string;
  profileId: string;
  isSupportChannel?: boolean;
}) {
  const { orgId, channelId, profileId, isSupportChannel = false } = input;
  const enableChannelCommunications = useMobileFeatureFlag(
    mobileFeatureFlagKeys.enableChannelCommunications,
  );
  const enableMentions = useMobileFeatureFlag(
    mobileFeatureFlagKeys.enableMobileMessageComposerParity,
  );
  const canChooseMessageAudience = enableChannelCommunications && !isSupportChannel;

  const { data: channelMembers } = useQuery({
    queryKey: ['channelMembers', orgId, channelId, profileId] as const,
    queryFn: () => fetchChannelMembers(orgId, channelId, profileId),
    enabled:
      (enableMentions || canChooseMessageAudience) &&
      !!orgId &&
      !!channelId &&
      !!profileId,
    staleTime: 60_000,
  });

  const mentionCandidates = useMemo(
    () => getMentionCandidates(channelMembers ?? [], profileId),
    [channelMembers, profileId],
  );

  const isStaffReviewMessage = useCallback(
    (message: MessageVM) =>
      isOutsideMessageAudience({
        visibility: message.core.visibility,
        senderProfileId: message.core.sender.ids.id,
        viewerProfileId: profileId,
      }),
    [profileId],
  );

  return {
    canChooseMessageAudience,
    enableMentions,
    channelMembers,
    mentionCandidates,
    isStaffReviewMessage,
  };
}
