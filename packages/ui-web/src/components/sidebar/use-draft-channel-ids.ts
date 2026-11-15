import * as React from 'react';
import {
  hasNonExpiredDraft,
  MESSAGE_DRAFT_CHANGE_EVENT,
} from '@iconicedu/ui-web/components/messages/message-draft-store';

export type DraftChannelIdsScope = {
  enabled: boolean;
  accountId?: string | null;
  profileId?: string | null;
  channels: Array<{ id: string; orgId: string }>;
};

/**
 * Computes the set of channel ids that currently have a non-expired
 * "main composer" draft for the given account+profile, and keeps it in sync
 * with `message-draft-store` writes (same tab) and cross-tab `storage`
 * events, so sidebar rows never need to scan localStorage on every render.
 */
export function useDraftChannelIds({
  enabled,
  accountId,
  profileId,
  channels,
}: DraftChannelIdsScope): Set<string> {
  const channelsKey = channels
    .map((channel) => `${channel.orgId}:${channel.id}`)
    .join('|');

  const computeDraftChannelIds = React.useCallback((): Set<string> => {
    if (!enabled || !accountId || !profileId) {
      return new Set();
    }
    const next = new Set<string>();
    channels.forEach((channel) => {
      const hasDraft = hasNonExpiredDraft({
        accountId,
        profileId,
        orgId: channel.orgId,
        channelId: channel.id,
        threadId: null,
      });
      if (hasDraft) {
        next.add(channel.id);
      }
    });
    return next;
    // channelsKey captures the same information as `channels` in a stable,
    // comparable form for the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, accountId, profileId, channelsKey]);

  const [draftChannelIds, setDraftChannelIds] = React.useState<Set<string>>(() =>
    computeDraftChannelIds(),
  );

  React.useEffect(() => {
    setDraftChannelIds(computeDraftChannelIds());
  }, [computeDraftChannelIds]);

  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }
    const handleChange = () => setDraftChannelIds(computeDraftChannelIds());
    window.addEventListener(MESSAGE_DRAFT_CHANGE_EVENT, handleChange);
    window.addEventListener('storage', handleChange);
    return () => {
      window.removeEventListener(MESSAGE_DRAFT_CHANGE_EVENT, handleChange);
      window.removeEventListener('storage', handleChange);
    };
  }, [enabled, computeDraftChannelIds]);

  return draftChannelIds;
}
