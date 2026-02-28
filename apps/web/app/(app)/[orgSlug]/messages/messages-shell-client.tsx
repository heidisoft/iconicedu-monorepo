'use client';

import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import type {
  ChannelVM,
  MessageSendFileInput,
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
import {
  buildMessageAssetPath,
  buildStorageFileKey,
  STORAGE_PATH_SEGMENTS,
  getChannelFilesBucket,
} from '@iconicedu/web/lib/storage/storage-paths';
import { mapProfilePresenceRowToVM } from '@iconicedu/web/lib/profile/mappers/presence.mapper';
import {
  applyPresenceToChannelParticipants,
  applyRealtimeOnlineProfilesToChannelParticipants,
} from '@iconicedu/web/lib/presence/apply-presence';
import { extractOnlineProfileIdsFromPresenceState } from '@iconicedu/web/lib/presence/realtime-presence';

function inferStorageAssetKind(file: File): 'files' | 'images' | 'audio' {
  if (file.type.startsWith('image/')) {
    return STORAGE_PATH_SEGMENTS.images;
  }
  if (file.type.startsWith('audio/')) {
    return STORAGE_PATH_SEGMENTS.audio;
  }
  return STORAGE_PATH_SEGMENTS.files;
}

export function buildMessageFileStoragePath(input: {
  orgId: string;
  channelId: string;
  profileId: string;
  file: File;
}) {
  return buildMessageAssetPath({
    orgId: input.orgId,
    channelId: input.channelId,
    profileId: input.profileId,
    assetKind: inferStorageAssetKind(input.file),
    fileName: buildStorageFileKey({
      name: input.file.name,
      fallbackBaseName: 'file',
    }),
  });
}

type MessagesShellClientProps = {
  channel: ChannelVM;
  currentUserId?: string;
  currentUserProfile?: UserProfileVM | null;
  readOnly?: boolean;
  panelRegistry?: Partial<
    MessagesRightPanelRegistry<ComponentType<{ intent: MessagesRightPanelIntent }>>
  >;
  sendTextMessage: (input: MessageSendTextInput) => Promise<MessageVM>;
  sendFileMessage: (input: MessageSendFileInput) => Promise<MessageVM>;
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
  sendFileMessage,
  toggleReaction,
  deleteMessage,
  toggleHiddenMessage,
}: MessagesShellClientProps) {
  const [channelState, setChannelState] = useState(channel);
  const onlineProfileIdsRef = useRef(new Set<string>());
  const presenceClient = useMemo(() => createSupabaseBrowserClient(), []);
  const realtimeClient = useMemo(() => createSupabaseMessagesRealtimeClient(), []);
  const messageWriteClient = useMemo(
    () => ({
      sendTextMessage,
      toggleReaction,
      deleteMessage,
      toggleHiddenMessage,
    }),
    [sendTextMessage, toggleReaction, deleteMessage, toggleHiddenMessage],
  );
  const uploadFileMessage = useMemo(
    () =>
      async (input: {
        file: File;
        content?: string;
        durationSeconds?: number;
        threadId?: string | null;
        threadParentId?: string | null;
      }) => {
        if (!currentUserId) {
          throw new Error('Current user is required');
        }

        const storagePath = buildMessageFileStoragePath({
          orgId: channelState.ids.orgId,
          channelId: channelState.ids.id,
          profileId: currentUserId,
          file: input.file,
        });

        const uploadResponse = await presenceClient.storage
          .from(getChannelFilesBucket())
          .upload(storagePath, input.file, {
            upsert: false,
            contentType: input.file.type || 'application/octet-stream',
          });

        if (uploadResponse.error) {
          throw new Error(uploadResponse.error.message);
        }

        return sendFileMessage({
          orgId: channelState.ids.orgId,
          channelId: channelState.ids.id,
          senderProfileId: currentUserId,
          name: input.file.name,
          storagePath,
          size: input.file.size,
          mimeType: input.file.type || undefined,
          durationSeconds: input.durationSeconds,
          content: input.content,
          threadId: input.threadId,
          threadParentId: input.threadParentId,
        });
      },
    [channelState.ids.id, channelState.ids.orgId, currentUserId, presenceClient, sendFileMessage],
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
      uploadFileMessage={uploadFileMessage}
    />
  );
}
