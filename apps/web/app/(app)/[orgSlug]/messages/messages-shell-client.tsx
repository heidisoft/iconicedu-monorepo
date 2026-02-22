'use client';

import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import type {
  ChannelVM,
  MessageSendTextInput,
  MessageVM,
  MessagesRightPanelIntent,
  MessagesRightPanelRegistry,
  ProfilePresenceRow,
  UserProfileVM,
} from '@iconicedu/shared-types';
import { MessagesShell } from '@iconicedu/ui-web';

import { createSupabaseMessagesRealtimeClient } from '@iconicedu/web/lib/messages/realtime/supabase-messages-realtime-client';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { mapProfilePresenceRowToVM } from '@iconicedu/web/lib/profile/mappers/presence.mapper';
import {
  applyPresenceToChannelParticipants,
  applyRealtimeOnlineProfilesToChannelParticipants,
} from '@iconicedu/web/lib/presence/apply-presence';
import { extractOnlineProfileIdsFromPresenceState } from '@iconicedu/web/lib/presence/realtime-presence';

type MessagesShellClientProps = {
  channel: ChannelVM;
  currentUserId?: string;
  currentUserProfile?: UserProfileVM | null;
  readOnly?: boolean;
  panelRegistry?: Partial<
    MessagesRightPanelRegistry<ComponentType<{ intent: MessagesRightPanelIntent }>>
  >;
  sendTextMessage: (input: MessageSendTextInput) => Promise<MessageVM>;
  toggleReaction: (input: { orgId: string; messageId: string; emoji: string }) => Promise<void>;
  deleteMessage: (input: { orgId: string; messageId: string }) => Promise<void>;
  toggleHiddenMessage: (input: { orgId: string; messageId: string; isHidden: boolean }) => Promise<void>;
};

export function MessagesShellClient({
  channel,
  currentUserId,
  currentUserProfile,
  readOnly = false,
  panelRegistry,
  sendTextMessage,
  toggleReaction,
  deleteMessage,
  toggleHiddenMessage,
}: MessagesShellClientProps) {
  const [channelState, setChannelState] = useState(channel);
  const onlineProfileIdsRef = useRef(new Set<string>());
  const presenceClient = useMemo(() => createSupabaseBrowserClient(), []);
  const realtimeClient = useMemo(() => createSupabaseMessagesRealtimeClient(), []);
  const messageWriteClient = useMemo(
    () => ({ sendTextMessage, toggleReaction, deleteMessage, toggleHiddenMessage }),
    [sendTextMessage, toggleReaction, deleteMessage, toggleHiddenMessage],
  );

  useEffect(() => {
    setChannelState(channel);
  }, [channel]);

  useEffect(() => {
    const orgId = channelState.ids.orgId;
    const participantIds = new Set(
      channelState.collections.participants.map((participant) => participant.ids.id),
    );
    if (!participantIds.size) {
      return;
    }

    const realtimeChannel = presenceClient.channel(
      `messages-presence:${orgId}:${channelState.ids.id}`,
    );
    const syncOnlineProfiles = () => {
      const onlineProfileIds = extractOnlineProfileIdsFromPresenceState(
        realtimeChannel.presenceState?.() ?? {},
      );
      onlineProfileIdsRef.current = onlineProfileIds;
      setChannelState((prev) =>
        applyRealtimeOnlineProfilesToChannelParticipants(prev, onlineProfileIds),
      );
    };
    realtimeChannel.on('presence', { event: 'sync' }, syncOnlineProfiles);
    realtimeChannel.on('presence', { event: 'join' }, syncOnlineProfiles);
    realtimeChannel.on('presence', { event: 'leave' }, syncOnlineProfiles);
    realtimeChannel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profile_presence',
        filter: `org_id=eq.${orgId}`,
      },
      (payload) => {
        const row =
          payload.eventType === 'DELETE'
            ? ((payload.old as ProfilePresenceRow | null) ?? null)
            : ((payload.new as ProfilePresenceRow | null) ?? null);
        const profileId = row?.profile_id;
        if (!profileId || !participantIds.has(profileId)) {
          return;
        }
        const presence =
          payload.eventType === 'DELETE' ? null : mapProfilePresenceRowToVM(row);
        setChannelState((prev) =>
          applyRealtimeOnlineProfilesToChannelParticipants(
            applyPresenceToChannelParticipants(prev, profileId, presence),
            onlineProfileIdsRef.current,
          ),
        );
      },
    );
    realtimeChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED' && currentUserId) {
        void realtimeChannel.track({
          profile_id: currentUserId,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      if (realtimeChannel.untrack) {
        void realtimeChannel.untrack();
      }
      void realtimeChannel.unsubscribe();
    };
  }, [
    presenceClient,
    currentUserId,
    channelState.ids.orgId,
    channelState.ids.id,
    channelState.collections.participants,
  ]);

  return (
    <MessagesShell
      channel={channelState}
      currentUserId={currentUserId}
      currentUserProfile={currentUserProfile}
      readOnly={readOnly}
      panelRegistry={panelRegistry}
      realtimeClient={realtimeClient}
      messageWriteClient={messageWriteClient}
    />
  );
}
