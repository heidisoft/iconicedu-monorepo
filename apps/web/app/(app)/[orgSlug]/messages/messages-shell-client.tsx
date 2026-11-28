'use client';

import type { LiveSessionJoinLinkVM } from '@iconicedu/shared-types';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import type {
  ChannelVM,
  MessageEditTextInput,
  MessageSendFileInput,
  MessageSendFilesInput,
  MessageSendTextInput,
  MessageVM,
  MessagesRightPanelIntent,
  MessagesRightPanelRegistry,
  ProfilePresenceRow,
  UserProfileVM,
} from '@iconicedu/shared-types';
import { MessagesShell } from '@iconicedu/ui-web';
import { ExternalLiveSessionJoinDialog } from '@iconicedu/ui-web/components/messages/external-live-session-join-dialog';
import { useLiveSessionNavigation } from '@iconicedu/web/components/live-sessions/use-live-session-navigation';

import { createApiClient } from '@iconicedu/web/lib/api/http-client';
import {
  unwrapMessageSendResult,
  type MessageSendRejection,
} from '@iconicedu/web/lib/messages/message-send-rejection';
import { createSupabaseMessagesRealtimeClient } from '@iconicedu/web/lib/messages/realtime/supabase-messages-realtime-client';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import {
  buildMessageAssetPath,
  buildMessageThumbnailPath,
  buildStorageFileKey,
  STORAGE_PATH_SEGMENTS,
  getChannelFilesBucket,
  getMessageThumbnailsBucket,
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

const IMAGE_THUMBNAIL_MAX_DIMENSION = 480;
const IMAGE_THUMBNAIL_QUALITY = 0.72;

async function createImageThumbnailFile(file: File): Promise<File | null> {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    !file.type.startsWith('image/')
  ) {
    return null;
  }

  return new Promise<File | null>((resolve) => {
    const image = new globalThis.Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      const maxSide = Math.max(image.width, image.height);
      const scale =
        maxSide > IMAGE_THUMBNAIL_MAX_DIMENSION
          ? IMAGE_THUMBNAIL_MAX_DIMENSION / maxSide
          : 1;
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');

      if (!context) {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            resolve(null);
            return;
          }

          const fallbackBaseName = file.name.replace(/\.[^/.]+$/, '') || 'thumbnail';
          resolve(
            new File([blob], `${fallbackBaseName}.jpg`, {
              type: 'image/jpeg',
            }),
          );
        },
        'image/jpeg',
        IMAGE_THUMBNAIL_QUALITY,
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    image.src = objectUrl;
  });
}

type MessagesShellClientProps = {
  orgSlug: string;
  channel: ChannelVM;
  currentUserId?: string;
  currentUserProfile?: UserProfileVM | null;
  readOnly?: boolean;
  showCreateMessageTypeButton?: boolean;
  enableMessagePinning?: boolean;
  enableMessageSearch?: boolean;
  enableScheduledSend?: boolean;
  enableMessageMarkUnread?: boolean;
  enableMessageReplyReference?: boolean;
  enableNotificationConversationControls?: boolean;
  enableMessageListFormatting?: boolean;
  enableMessageSendReliability?: boolean;
  enableMessageAudience?: boolean;
  enableStaffMessageReview?: boolean;
  panelRegistry?: Partial<
    MessagesRightPanelRegistry<ComponentType<{ intent: MessagesRightPanelIntent }>>
  >;

  sendTextMessage: (
    input: MessageSendTextInput,
  ) => Promise<MessageVM | MessageSendRejection>;
  sendFileMessage: (
    input: MessageSendFileInput,
  ) => Promise<MessageVM | MessageSendRejection>;
  sendFilesMessage: (
    input: MessageSendFilesInput,
  ) => Promise<MessageVM | MessageSendRejection>;
  editTextMessage: (input: MessageEditTextInput) => Promise<MessageVM>;
  toggleReaction: (input: {
    orgId: string;
    messageId: string;
    emoji: string;
  }) => Promise<void>;
  toggleSavedMessage: (input: {
    orgId: string;
    messageId: string;
    isSaved: boolean;
  }) => Promise<void>;
  deleteMessage: (input: { orgId: string; messageId: string }) => Promise<void>;
  toggleHiddenMessage: (input: {
    orgId: string;
    messageId: string;
    isHidden: boolean;
  }) => Promise<void>;
};

export function MessagesShellClient({
  channel,
  currentUserId,
  currentUserProfile,
  readOnly = false,
  showCreateMessageTypeButton = true,
  enableMessagePinning = false,
  enableMessageSearch = false,
  enableScheduledSend = false,
  enableMessageMarkUnread = false,
  enableMessageReplyReference = false,
  enableNotificationConversationControls = false,
  enableMessageListFormatting = false,
  enableMessageSendReliability = false,
  enableMessageAudience = false,
  enableStaffMessageReview = false,
  panelRegistry,
  sendTextMessage: sendTextMessageAction,
  sendFileMessage: sendFileMessageAction,
  sendFilesMessage: sendFilesMessageAction,
  editTextMessage,
  toggleReaction,
  toggleSavedMessage,
  deleteMessage,
  toggleHiddenMessage,
}: MessagesShellClientProps) {
  // Server actions return safeguarding/permission refusals instead of throwing
  // (Next.js hides thrown messages in production); surface them as a
  // MessageSendRejectedError so the composer can show the reason.
  const sendTextMessage = useCallback(
    async (input: MessageSendTextInput) =>
      unwrapMessageSendResult(await sendTextMessageAction(input)),
    [sendTextMessageAction],
  );
  const sendFileMessage = useCallback(
    async (input: MessageSendFileInput) =>
      unwrapMessageSendResult(await sendFileMessageAction(input)),
    [sendFileMessageAction],
  );
  const sendFilesMessage = useCallback(
    async (input: MessageSendFilesInput) =>
      unwrapMessageSendResult(await sendFilesMessageAction(input)),
    [sendFilesMessageAction],
  );
  const [channelState, setChannelState] = useState(channel);
  const onlineProfileIdsRef = useRef(new Set<string>());
  const presenceClient = useMemo(() => createSupabaseBrowserClient(), []);
  const realtimeClient = useMemo(() => createSupabaseMessagesRealtimeClient(), []);
  const { externalJoinTarget, closeExternalJoinDialog, handleResolvedJoinHref } =
    useLiveSessionNavigation();
  const messageWriteClient = useMemo(
    () => ({
      sendTextMessage,
      editTextMessage,
      toggleReaction,
      toggleSavedMessage,
      deleteMessage,
      toggleHiddenMessage,
    }),
    [
      sendTextMessage,
      editTextMessage,
      toggleReaction,
      toggleSavedMessage,
      deleteMessage,
      toggleHiddenMessage,
    ],
  );
  const uploadFileMessage = useMemo(
    () =>
      async (input: {
        attachments: Array<{ file: File; durationSeconds?: number }>;
        content?: string;
        threadId?: string | null;
        threadParentId?: string | null;
        audienceProfileIds?: string[];
      }) => {
        if (!currentUserId) {
          throw new Error('Current user is required');
        }

        const uploads = await Promise.all(
          input.attachments.map(async (attachment) => {
            const storagePath = buildMessageFileStoragePath({
              orgId: channelState.ids.orgId,
              channelId: channelState.ids.id,
              profileId: currentUserId,
              file: attachment.file,
            });

            const uploadResponse = await presenceClient.storage
              .from(getChannelFilesBucket())
              .upload(storagePath, attachment.file, {
                upsert: false,
                contentType: attachment.file.type || 'application/octet-stream',
              });

            if (uploadResponse.error) {
              throw new Error(uploadResponse.error.message);
            }

            let thumbnailUrl: string | undefined;
            if ((attachment.file.type || '').startsWith('image/')) {
              const thumbnailFile = await createImageThumbnailFile(attachment.file);
              if (thumbnailFile) {
                const thumbnailPath = buildMessageThumbnailPath({
                  orgId: channelState.ids.orgId,
                  channelId: channelState.ids.id,
                  profileId: currentUserId,
                  fileName: buildStorageFileKey({
                    name: thumbnailFile.name,
                    fallbackBaseName: 'thumbnail',
                    fallbackExtension: 'jpg',
                  }),
                });

                const thumbnailUploadResponse = await presenceClient.storage
                  .from(getMessageThumbnailsBucket())
                  .upload(thumbnailPath, thumbnailFile, {
                    upsert: false,
                    contentType: thumbnailFile.type || 'image/jpeg',
                  });

                if (!thumbnailUploadResponse.error) {
                  thumbnailUrl = presenceClient.storage
                    .from(getMessageThumbnailsBucket())
                    .getPublicUrl(thumbnailPath).data.publicUrl;
                }
              }
            }

            return {
              file: attachment.file,
              durationSeconds: attachment.durationSeconds,
              storagePath,
              thumbnailUrl,
            };
          }),
        );

        const nonAudioUploads = uploads.filter(
          (upload) => !(upload.file.type || '').startsWith('audio/'),
        );
        const audioUploads = uploads.filter((upload) =>
          (upload.file.type || '').startsWith('audio/'),
        );
        const imageUploads = nonAudioUploads.filter((upload) =>
          (upload.file.type || '').startsWith('image/'),
        );
        const fileUploads = nonAudioUploads.filter(
          (upload) => !(upload.file.type || '').startsWith('image/'),
        );

        const createdMessages: MessageVM[] = [];

        if (
          imageUploads.length === 1 &&
          audioUploads.length === 0 &&
          fileUploads.length === 0
        ) {
          createdMessages.push(
            await sendFileMessage({
              orgId: channelState.ids.orgId,
              channelId: channelState.ids.id,
              senderProfileId: currentUserId,
              name: imageUploads[0].file.name,
              storagePath: imageUploads[0].storagePath,
              thumbnailUrl: imageUploads[0].thumbnailUrl,
              size: imageUploads[0].file.size,
              mimeType: imageUploads[0].file.type || undefined,
              content: input.content,
              threadId: input.threadId,
              threadParentId: input.threadParentId,
              audience: input.audienceProfileIds?.length
                ? { profileIds: input.audienceProfileIds }
                : undefined,
            }),
          );
        } else if (imageUploads.length > 1) {
          createdMessages.push(
            await sendFilesMessage({
              orgId: channelState.ids.orgId,
              channelId: channelState.ids.id,
              senderProfileId: currentUserId,
              assets: imageUploads.map((upload) => ({
                name: upload.file.name,
                storagePath: upload.storagePath,
                thumbnailUrl: upload.thumbnailUrl,
                size: upload.file.size,
                mimeType: upload.file.type || undefined,
              })),
              content: input.content,
              threadId: input.threadId,
              threadParentId: input.threadParentId,
              audience: input.audienceProfileIds?.length
                ? { profileIds: input.audienceProfileIds }
                : undefined,
            }),
          );
        }

        if (fileUploads.length === 1) {
          createdMessages.push(
            await sendFileMessage({
              orgId: channelState.ids.orgId,
              channelId: channelState.ids.id,
              senderProfileId: currentUserId,
              name: fileUploads[0].file.name,
              storagePath: fileUploads[0].storagePath,
              size: fileUploads[0].file.size,
              mimeType: fileUploads[0].file.type || undefined,
              content: imageUploads.length ? undefined : input.content,
              threadId: input.threadId,
              threadParentId: input.threadParentId,
              audience: input.audienceProfileIds?.length
                ? { profileIds: input.audienceProfileIds }
                : undefined,
            }),
          );
        } else if (fileUploads.length > 1) {
          createdMessages.push(
            await sendFilesMessage({
              orgId: channelState.ids.orgId,
              channelId: channelState.ids.id,
              senderProfileId: currentUserId,
              assets: fileUploads.map((upload) => ({
                name: upload.file.name,
                storagePath: upload.storagePath,
                size: upload.file.size,
                mimeType: upload.file.type || undefined,
              })),
              content: imageUploads.length ? undefined : input.content,
              threadId: input.threadId,
              threadParentId: input.threadParentId,
              audience: input.audienceProfileIds?.length
                ? { profileIds: input.audienceProfileIds }
                : undefined,
            }),
          );
        }

        for (const audioUpload of audioUploads) {
          createdMessages.push(
            await sendFileMessage({
              orgId: channelState.ids.orgId,
              channelId: channelState.ids.id,
              senderProfileId: currentUserId,
              name: audioUpload.file.name,
              storagePath: audioUpload.storagePath,
              size: audioUpload.file.size,
              mimeType: audioUpload.file.type || undefined,
              durationSeconds: audioUpload.durationSeconds,
              content:
                imageUploads.length || fileUploads.length || createdMessages.length > 0
                  ? undefined
                  : input.content,
              threadId: input.threadId,
              threadParentId: input.threadParentId,
              audience: input.audienceProfileIds?.length
                ? { profileIds: input.audienceProfileIds }
                : undefined,
            }),
          );
        }

        return createdMessages;
      },
    [
      channelState.ids.id,
      channelState.ids.orgId,
      currentUserId,
      presenceClient,
      sendFileMessage,
      sendFilesMessage,
    ],
  );

  const joinLiveSession = useCallback(async () => {
    if (!currentUserId) {
      throw new Error('Current user is required');
    }

    const payload = await createApiClient(presenceClient).post<LiveSessionJoinLinkVM>(
      `/channels/${channelState.ids.id}/live-sessions/join`,
      {
        orgId: channelState.ids.orgId,
        profileId: currentUserId,
      },
    );

    handleResolvedJoinHref(payload.joinPath, payload.provider, payload.passcode);
  }, [
    channelState.ids.id,
    channelState.ids.orgId,
    currentUserId,
    handleResolvedJoinHref,
    presenceClient,
  ]);

  useEffect(() => {
    setChannelState(channel);
  }, [channel]);

  // Presence updates replace participant objects; only membership changes should
  // restart the subscription, otherwise join/leave events create a feedback loop.
  const presenceParticipantIdsKey = channelState.collections.participants
    .map((participant) => participant.ids.id)
    .sort()
    .join(',');

  useEffect(() => {
    const orgId = channelState.ids.orgId;
    const participantIds = new Set(presenceParticipantIdsKey.split(',').filter(Boolean));
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
    presenceParticipantIdsKey,
  ]);

  return (
    <>
      <MessagesShell
        channel={channelState}
        currentUserId={currentUserId}
        currentUserProfile={currentUserProfile}
        readOnly={readOnly}
        showCreateMessageTypeButton={showCreateMessageTypeButton}
        enableMessagePinning={enableMessagePinning}
        enableMessageSearch={enableMessageSearch}
        enableScheduledSend={enableScheduledSend}
        enableMessageMarkUnread={enableMessageMarkUnread}
        enableMessageReplyReference={enableMessageReplyReference}
        enableNotificationConversationControls={enableNotificationConversationControls}
        enableMessageListFormatting={enableMessageListFormatting}
        enableMessageSendReliability={enableMessageSendReliability}
        enableMessageAudience={enableMessageAudience}
        enableStaffMessageReview={enableStaffMessageReview}
        panelRegistry={panelRegistry}
        realtimeClient={realtimeClient}
        messageWriteClient={messageWriteClient}
        uploadFileMessage={uploadFileMessage}
        joinLiveSession={joinLiveSession}
      />

      <ExternalLiveSessionJoinDialog
        target={externalJoinTarget}
        onOpenChange={(open) => {
          if (!open) {
            closeExternalJoinDialog();
          }
        }}
      />
    </>
  );
}
