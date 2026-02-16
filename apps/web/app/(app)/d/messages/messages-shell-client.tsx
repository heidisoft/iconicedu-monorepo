'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
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
import { applyPresenceToChannelParticipants } from '@iconicedu/web/lib/presence/apply-presence';

type MessagesShellClientProps = {
  channel: ChannelVM;
  currentUserId?: string;
  currentUserProfile?: UserProfileVM | null;
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
  panelRegistry,
  sendTextMessage,
  toggleReaction,
  deleteMessage,
  toggleHiddenMessage,
}: MessagesShellClientProps) {
  const [channelState, setChannelState] = useState(channel);
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
          applyPresenceToChannelParticipants(prev, profileId, presence),
        );
      },
    );
    realtimeChannel.subscribe();

    return () => {
      void realtimeChannel.unsubscribe();
    };
  }, [
    presenceClient,
    channelState.ids.orgId,
    channelState.ids.id,
    channelState.collections.participants,
  ]);

  return (
    <MessagesShell
      channel={channelState}
      currentUserId={currentUserId}
      currentUserProfile={currentUserProfile}
      panelRegistry={panelRegistry}
      realtimeClient={realtimeClient}
      messageWriteClient={messageWriteClient}
    />
  );
}
