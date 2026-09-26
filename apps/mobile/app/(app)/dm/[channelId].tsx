import React, { useState, useCallback, useEffect, useRef } from 'react';
import { reportMobileObservedError } from '@/lib/analytics/report-error';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { MessageMentionVM, MessageVM, UserProfileVM } from '@iconicedu/shared-types';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import { useMessages } from '@/hooks/use-messages';
import {
  sendTextMessage,
  sendFileMessage,
  sendFilesMessage,
  editTextMessage,
  uploadChannelFile,
  buildMessageStoragePath,
  deleteMessage,
  fetchChannelMembers,
  fetchChannelReadState,
  fetchDirectMessageChannelMetaByChannelId,
  ensureDirectMessageChannelForProfiles,
  markChannelUnread,
  queryKeys,
} from '@/lib/api/queries';
import { useTheme } from '@/providers/theme-provider';
import {
  useOnlineProfileIds,
  useProfilePresenceSummary,
} from '@/hooks/use-online-profile-ids';
import { resolveMobileMessageUiTheme } from '@/components/messages/themes/registry';
import {
  MessageInput,
  type EditingMessageContext,
} from '@/components/messages/message-input';
import { TypingIndicator } from '@/components/messages/typing-indicator';
import { ConversationHeader } from '@/components/messages/conversation-header';
import { MessageActionsSheet } from '@/components/messages/message-actions-sheet';
import { ChannelInfoSheet } from '@/components/messages/channel-info-sheet';
import { ProfileSheet } from '@/components/messages/profile-sheet';
import { MessageBubblesSkeleton } from '@/components/skeletons';
import { buildMobileChannelEmptyStateCopy } from '@/lib/message-empty-state';
import type { AttachmentPayload } from '@/components/messages/attachment-sheet';
import type { PendingUpload } from '@/components/messages/pending-message-row';
import { useMarkRead } from '@/hooks/use-mark-read';
import { applyOptimisticChannelManualUnread } from '@/lib/messages/apply-optimistic-channel-read-state';
import type { ChannelListItem, DmParticipant } from '@/lib/api/types';
import { useMobileFeatureFlag } from '@/hooks/use-mobile-feature-flag';
import { mobileFeatureFlagKeys } from '@/lib/feature-flags';
import { buildLocalTimeContext, formatLocalTimeText } from '@/lib/local-time-context';
import { usePushNudge } from '@/hooks/use-push-nudge';
import { usePushConsent } from '@/providers/push-consent-provider';
import { PushNudgeSheet } from '@/components/notifications/push-nudge-sheet';
import { getMentionCandidates } from '@/lib/messages/message-mentions';

function participantName(participant: DmParticipant | null | undefined): string | null {
  if (!participant) return null;
  return (
    participant.display_name?.trim() ||
    [participant.first_name, participant.last_name].filter(Boolean).join(' ').trim() ||
    null
  );
}

function getDmPartner(meta: ChannelListItem | null | undefined) {
  return meta?.participants?.[0] ?? null;
}

export default function DmConversationScreen() {
  const {
    channelId,
    avatarThemeKey,
    avatarTimezone,
    avatarCity,
    avatarCountryCode,
    avatarCountryName,
  } = useLocalSearchParams<{
    channelId: string;
    avatarThemeKey?: string;
    avatarTimezone?: string;
    avatarCity?: string;
    avatarCountryCode?: string;
    avatarCountryName?: string;
  }>();

  const router = useRouter();
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const { colors } = useTheme();
  const enableMobileDirectMessageStart = useMobileFeatureFlag(
    mobileFeatureFlagKeys.enableMobileDirectMessageStart,
  );
  const enableMessageReplyReference = useMobileFeatureFlag(
    mobileFeatureFlagKeys.enableMessageReplyReference,
  );
  const enableMessageMarkUnread = useMobileFeatureFlag(
    mobileFeatureFlagKeys.enableMessageMarkUnread,
  );
  const enableMessageDrafts = useMobileFeatureFlag(
    mobileFeatureFlagKeys.enableMessageDrafts,
  );
  const enableMessageEdit = useMobileFeatureFlag(mobileFeatureFlagKeys.enableMessageEdit);
  const enableMobileMessageComposerParity = useMobileFeatureFlag(
    mobileFeatureFlagKeys.enableMobileMessageComposerParity,
  );
  const enableMessageSendReliability = useMobileFeatureFlag(
    mobileFeatureFlagKeys.enableMessageSendReliability,
  );
  const ThemedMessageList = resolveMobileMessageUiTheme('classic').MessageList;

  const orgId = account?.org_id ?? '';
  const accountId =
    ((account as Record<string, unknown> | undefined)?.id as string) ?? '';
  const profileRecord = (profile as Record<string, unknown> | undefined) ?? undefined;
  const profileId = (profileRecord?.id as string | undefined) ?? '';
  const senderName =
    (profileRecord?.display_name as string | undefined)?.trim() ||
    (profileRecord?.first_name as string | undefined)?.trim() ||
    'Me';
  const { data: dmMeta, isLoading: isLoadingDmMeta } = useQuery({
    queryKey: queryKeys.directMessageChannelMeta(channelId ?? '', orgId, profileId),
    queryFn: () =>
      fetchDirectMessageChannelMetaByChannelId(
        orgId,
        profileId,
        accountId,
        channelId ?? '',
      ),
    enabled: !!channelId && !!orgId && !!profileId && !!accountId,
    staleTime: 5 * 60 * 1000,
  });
  // DM participants — only needed for @mention autocomplete, so skip the
  // request entirely unless mention authoring is enabled.
  const { data: dmMembers } = useQuery({
    queryKey: ['channelMembers', orgId, channelId, profileId] as const,
    queryFn: () => fetchChannelMembers(orgId, channelId ?? '', profileId),
    enabled: enableMobileMessageComposerParity && !!orgId && !!channelId && !!profileId,
    staleTime: 60_000,
  });
  const mentionCandidates = React.useMemo(
    () => getMentionCandidates(dmMembers ?? [], profileId),
    [dmMembers, profileId],
  );

  const dmPartner = getDmPartner(dmMeta);
  const resolvedTopic = participantName(dmPartner) ?? dmMeta?.topic ?? 'Direct Message';
  const resolvedAvatarSeed = dmPartner?.avatar_seed ?? dmPartner?.id ?? undefined;
  const resolvedPresenceProfileId = dmPartner?.id ?? '';
  const resolvedAvatarUrl = dmPartner?.avatar_url ?? undefined;
  const resolvedAvatarRole = dmPartner?.kind ?? undefined;
  const resolvedAvatarThemeKey = dmPartner?.ui_theme_key ?? avatarThemeKey ?? undefined;
  const resolvedAvatarTimezone = dmPartner?.timezone ?? avatarTimezone ?? undefined;
  const resolvedAvatarCity = dmPartner?.city ?? avatarCity ?? undefined;
  const resolvedAvatarCountryCode =
    dmPartner?.country_code ?? avatarCountryCode ?? undefined;
  const resolvedAvatarCountryName =
    dmPartner?.country_name ?? avatarCountryName ?? undefined;
  const resolvedSubtitle = dmMeta?.description ?? 'Direct Message';
  const resolvedIsSupervised = dmMeta?.is_supervised === true;
  const resolvedSupervisedChildName = dmMeta?.supervised_child_name ?? undefined;
  const presenceByProfileId = useOnlineProfileIds(
    orgId,
    profileId,
    resolvedPresenceProfileId ? [resolvedPresenceProfileId] : [],
  );
  const headerPresenceStatus = resolvedPresenceProfileId
    ? (presenceByProfileId.get(resolvedPresenceProfileId) ?? null)
    : null;
  const headerPresenceSummary = useProfilePresenceSummary(
    orgId,
    resolvedPresenceProfileId,
  );

  const formatRelativeLastSeen = useCallback((iso: string | null) => {
    if (!iso) return null;
    const diffMs = Math.max(0, Date.now() - new Date(iso).getTime());
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(days / 365);
    return `${years}y ago`;
  }, []);

  const headerSubtitle = resolvedIsSupervised
    ? resolvedSupervisedChildName
      ? `Supervising ${resolvedSupervisedChildName}'s conversation`
      : 'Supervised Inbox'
    : (() => {
        if (headerPresenceSummary.status === 'online') {
          return 'Available';
        }
        const relative = formatRelativeLastSeen(headerPresenceSummary.lastSeenAt);
        if (!relative) {
          return resolvedSubtitle;
        }
        return `Last seen ${relative}`;
      })();
  const headerLocalTime = resolvedIsSupervised
    ? null
    : (() => {
        const timeText = formatLocalTimeText(resolvedAvatarTimezone);
        return timeText ? timeText : null;
      })();
  const headerLocalTimeContext = resolvedIsSupervised
    ? null
    : buildLocalTimeContext({
        timezone: resolvedAvatarTimezone,
        city: resolvedAvatarCity,
        countryCode: resolvedAvatarCountryCode,
        countryName: resolvedAvatarCountryName,
        presenceStatus: headerPresenceStatus ?? headerPresenceSummary.status,
      });

  const {
    data: messages,
    isPending: isLoading,
    isRefetching,
    refetch,
    loadMore,
    toggleReaction,
    typingUsers,
    broadcastTyping,
    broadcastTypingStop,
    removeMessage,
    restoreMessage,
  } = useMessages(channelId ?? '', profileId, accountId, senderName, orgId);
  const { data: channelReadState } = useQuery({
    queryKey: queryKeys.channelReadState(channelId ?? '', accountId),
    queryFn: () => fetchChannelReadState(channelId ?? '', accountId),
    enabled: !!channelId && !!accountId,
    staleTime: 30_000,
  });
  const { markChannelRead, resetChannelReadGuard } = useMarkRead({
    orgId,
    profileId,
    accountId,
    channelId: channelId ?? '',
    profileKind: (profileRecord?.kind as string | null | undefined) ?? null,
    isFocused,
    isManuallyUnread: channelReadState?.isManuallyUnread,
    lastReadMessageId: channelReadState?.lastReadMessageId,
  });
  const isChannelUnread =
    (channelReadState?.unreadCount ?? 0) > 0 ||
    channelReadState?.isManuallyUnread === true;

  const refreshConversation = useCallback(async () => {
    await Promise.all([
      refetch(),
      channelId && accountId
        ? queryClient.refetchQueries({
            queryKey: queryKeys.channelReadState(channelId, accountId),
            exact: true,
          })
        : Promise.resolve(),
    ]);
  }, [accountId, channelId, queryClient, refetch]);

  useEffect(() => {
    if (!isFocused || !channelId || !orgId) return;
    void refreshConversation();
  }, [channelId, isFocused, orgId, refreshConversation]);

  // ── Info sheet state ──
  const [infoVisible, setInfoVisible] = useState(false);

  // ── Profile sheet state ──
  const [profileUser, setProfileUser] = useState<UserProfileVM | null>(null);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);

  const handleProfileMessagePress = useCallback(
    async (user: UserProfileVM) => {
      if (
        !enableMobileDirectMessageStart ||
        !orgId ||
        !profileId ||
        !user.ids.id ||
        user.ids.id === profileId
      ) {
        return;
      }

      try {
        const dm = await ensureDirectMessageChannelForProfiles(
          orgId,
          profileId,
          user.ids.id,
        );
        if (!dm) {
          Alert.alert('Unable to open direct message', 'Please try again.');
          return;
        }

        void queryClient.invalidateQueries({
          queryKey: queryKeys.directMessages(orgId, profileId),
        });
        setProfileUser(null);
        router.push({
          pathname: '/(app)/dm/[channelId]',
          params: {
            channelId: dm.channelId,
            topic: dm.topic,
            avatarSeed: dm.avatarSeed ?? '',
            avatarUrl: dm.avatarUrl ?? '',
            avatarRole: dm.avatarRole ?? '',
            avatarTimezone: dm.avatarTimezone ?? '',
            avatarCity: dm.avatarCity ?? '',
            avatarCountryCode: dm.avatarCountryCode ?? '',
            avatarCountryName: dm.avatarCountryName ?? '',
          },
        } as never);
      } catch {
        Alert.alert('Unable to open direct message', 'Please try again.');
      }
    },
    [enableMobileDirectMessageStart, orgId, profileId, queryClient, router],
  );

  // ── Long-press actions sheet state ──
  const [actionsMessage, setActionsMessage] = useState<MessageVM | null>(null);
  const [actionsVisible, setActionsVisible] = useState(false);

  const handleLongPress = useCallback((msg: MessageVM) => {
    setActionsMessage(msg);
    setActionsVisible(true);
  }, []);

  // ── Thread reply target — drives the reply preview above the input ──
  const [threadReplyTarget, setThreadReplyTarget] = useState<MessageVM | null>(null);
  // ── Quote reply target — distinct from "reply in thread"; drives its own preview ──
  const [quoteReplyTarget, setQuoteReplyTarget] = useState<MessageVM | null>(null);

  const handleThreadOpen = useCallback((msg: MessageVM) => {
    setQuoteReplyTarget(null);
    setThreadReplyTarget(msg);
  }, []);

  const handleQuoteReply = useCallback((msg: MessageVM) => {
    setThreadReplyTarget(null);
    setQuoteReplyTarget(msg);
  }, []);

  const handleMarkUnread = useCallback(
    async (_msg: MessageVM) => {
      if (!channelId || !orgId || !accountId || !profileId) return;
      try {
        await markChannelUnread({ orgId, accountId, profileId, channelId });
        applyOptimisticChannelManualUnread({
          queryClient,
          orgId,
          profileId,
          accountId,
          channelId,
          profileKind: (profileRecord?.kind as string | null | undefined) ?? null,
        });
        resetChannelReadGuard();
      } catch {
        Alert.alert('Unable to mark unread', 'Please try again.');
      }
    },
    [
      channelId,
      orgId,
      accountId,
      profileId,
      profileRecord,
      queryClient,
      resetChannelReadGuard,
    ],
  );

  // ── Edit sent text messages ──
  const [editingMessage, setEditingMessage] = useState<EditingMessageContext | null>(
    null,
  );

  const handleEditMessage = useCallback((message: MessageVM) => {
    const content = (message as { content?: { text?: string } }).content?.text ?? '';
    const mentions = (message as { content?: { mentions?: MessageMentionVM[] } }).content
      ?.mentions;
    setEditingMessage({ messageId: message.ids.id, content, mentions });
  }, []);

  const handleCancelEdit = useCallback(() => setEditingMessage(null), []);

  const handleSaveEdit = useCallback(
    async (input: {
      messageId: string;
      content: string;
      mentions?: MessageMentionVM[];
    }) => {
      const key = queryKeys.messages(channelId ?? '', profileId);
      const previous = queryClient.getQueryData<MessageVM[]>(key);

      queryClient.setQueryData<MessageVM[]>(key, (current) =>
        current?.map((message) =>
          message.ids.id === input.messageId
            ? ({
                ...message,
                content: { text: input.content, mentions: input.mentions },
                state: {
                  ...message.state,
                  isEdited: true,
                  editedAt: new Date().toISOString(),
                },
              } as MessageVM)
            : message,
        ),
      );

      try {
        await editTextMessage(input.messageId, orgId, input.content, input.mentions);
        void queryClient.invalidateQueries({ queryKey: key });
        return true;
      } catch (error) {
        queryClient.setQueryData(key, previous);
        reportMobileObservedError({
          error,
          source: 'mobile.messages.dm.edit_text',
          message: 'Failed to edit DM message',
          context: { channelId, orgId, profileId, messageId: input.messageId },
        });
        Alert.alert(
          'Unable to save edit',
          error instanceof Error
            ? error.message
            : 'Something went wrong. Please try again.',
        );
        return false;
      }
    },
    [channelId, orgId, profileId, queryClient],
  );

  // ── Push notification nudge ──
  const {
    isVisible: isNudgeVisible,
    nudgeVariant,
    triggerNudge,
    handleEnable: handleNudgeEnable,
    handleOpenSettings: handleNudgeOpenSettings,
    handleDismiss: handleNudgeDismiss,
  } = usePushNudge();
  const { requestPushConsent } = usePushConsent();

  const handlePushNotificationMoment = useCallback(async () => {
    const showedConsent = await requestPushConsent();
    if (!showedConsent) {
      await triggerNudge();
    }
  }, [requestPushConsent, triggerNudge]);

  // Tier 1: fire once when the first messages arrive — user is reading an incoming message,
  // which is the strongest signal that lock-screen delivery has value.
  const messagesNudgedRef = useRef(false);
  useEffect(() => {
    if (messagesNudgedRef.current || isLoading || !messages?.length) return;
    messagesNudgedRef.current = true;
    void triggerNudge();
  }, [isLoading, messages, triggerNudge]);

  // ── Send message ──
  // When a thread reply target is active, route the message into that thread.
  // meta.clientMessageId is only set when enableMessageSendReliability is on
  // (see MessageInput) — when present we track this send as a "Not sent" row
  // in pendingUploads instead of firing a one-shot Alert on failure, and
  // rethrow so MessageInput keeps the draft around for a retry.
  const handleSend = useCallback(
    async (
      text: string,
      meta?: { mentions?: MessageMentionVM[]; clientMessageId?: string },
    ) => {
      if (!channelId || !profileId || !orgId) return;
      const mentions = meta?.mentions;
      const clientMessageId = meta?.clientMessageId;
      const threadParentId = threadReplyTarget?.ids.id;
      const threadId = threadReplyTarget?.social?.thread?.ids.id;

      if (enableMessageSendReliability && clientMessageId) {
        setPendingUploads((prev) => [
          ...prev,
          {
            id: clientMessageId,
            type: 'text',
            attachments: [],
            senderName,
            createdAt: new Date().toISOString(),
            caption: text,
            clientMessageId,
            mentions,
            threadParentId,
            threadId,
          },
        ]);
        try {
          await sendTextMessage(
            channelId,
            profileId,
            orgId,
            text,
            threadParentId,
            threadId,
            {
              clientMessageId,
              mentions,
            },
          );
          setPendingUploads((prev) => prev.filter((p) => p.id !== clientMessageId));
          if (threadReplyTarget) {
            setThreadReplyTarget(null);
            void refetch();
          }
        } catch (error) {
          reportMobileObservedError({
            error,
            source: 'mobile.messages.dm.send_text',
            message: 'Failed to send DM',
            context: { channelId, orgId, profileId },
          });
          setPendingUploads((prev) =>
            prev.map((p) => (p.id === clientMessageId ? { ...p, failed: true } : p)),
          );
          throw error;
        }
        void handlePushNotificationMoment();
        return;
      }

      try {
        if (threadReplyTarget) {
          await sendTextMessage(
            channelId,
            profileId,
            orgId,
            text,
            threadParentId,
            threadId,
            mentions?.length ? { mentions } : undefined,
          );
          setThreadReplyTarget(null);
          // Refresh so the parent message's thread stats (reply count) update
          void refetch();
        } else if (quoteReplyTarget) {
          await sendTextMessage(
            channelId,
            profileId,
            orgId,
            text,
            undefined,
            undefined,
            quoteReplyTarget.ids.id,
          );
          setQuoteReplyTarget(null);
        } else {
          await sendTextMessage(
            channelId,
            profileId,
            orgId,
            text,
            undefined,
            undefined,
            mentions?.length ? { mentions } : undefined,
          );
        }
      } catch (error) {
        reportMobileObservedError({
          error,
          source: 'mobile.messages.dm.send_text',
          message: 'Failed to send DM',
          context: { channelId, orgId, profileId },
        });
        Alert.alert(
          'Failed to send',
          error instanceof Error
            ? error.message
            : 'Something went wrong. Please try again.',
        );
        return;
      }
      // Tier 2: user just sent a message — they expect a reply, high intent for push.
      void handlePushNotificationMoment();
    },
    [
      channelId,
      profileId,
      orgId,
      senderName,
      threadReplyTarget,
      quoteReplyTarget,
      refetch,
      handlePushNotificationMoment,
      enableMessageSendReliability,
    ],
  );

  // ── Retry a failed text send (reuses the same clientMessageId — idempotent) ──
  const handleRetryTextSend = useCallback(
    async (pendingId: string) => {
      const pending = pendingUploads.find((p) => p.id === pendingId);
      if (!pending || pending.type !== 'text' || !channelId || !profileId || !orgId)
        return;

      setPendingUploads((prev) =>
        prev.map((p) => (p.id === pendingId ? { ...p, failed: false } : p)),
      );

      try {
        await sendTextMessage(
          channelId,
          profileId,
          orgId,
          pending.caption ?? '',
          pending.threadParentId,
          pending.threadId,
          { clientMessageId: pending.clientMessageId, mentions: pending.mentions },
        );
        setPendingUploads((prev) => prev.filter((p) => p.id !== pendingId));
        if (pending.threadParentId) {
          void refetch();
        }
      } catch (error) {
        reportMobileObservedError({
          error,
          source: 'mobile.messages.dm.retry_text',
          message: 'Failed to retry DM send',
          context: { channelId, orgId, profileId, pendingId },
        });
        setPendingUploads((prev) =>
          prev.map((p) => (p.id === pendingId ? { ...p, failed: true } : p)),
        );
      }
    },
    [pendingUploads, channelId, profileId, orgId, refetch],
  );

  const handleSendAttachment = useCallback(
    async (
      attachments: AttachmentPayload[],
      caption?: string,
      clientMessageId?: string,
    ) => {
      if (!channelId || !profileId || !orgId || !attachments.length) return;

      const type: PendingUpload['type'] =
        attachments[0].mimeType === 'audio/mp4'
          ? 'audio'
          : attachments[0].mimeType.startsWith('image/')
            ? 'image'
            : 'file';

      const pendingId = `pending-${Date.now()}`;
      // clientMessageId is only set (by MessageInput) when send-reliability
      // is on — stored on the pending row and reused verbatim on retry so a
      // retry after a partial failure (upload ok, message insert failed)
      // can't create a duplicate message.

      setPendingUploads((prev) => [
        ...prev,
        {
          id: pendingId,
          type,
          attachments,
          senderName,
          createdAt: new Date().toISOString(),
          caption,
          clientMessageId,
        },
      ]);

      try {
        if (type === 'audio') {
          const attachment = attachments[0];
          const storagePath = buildMessageStoragePath(
            orgId,
            channelId,
            profileId,
            attachment.mimeType,
            attachment.name,
          );
          await uploadChannelFile(
            attachment.uri,
            storagePath,
            attachment.mimeType,
            attachment.base64,
          );
          await sendFileMessage(
            channelId,
            profileId,
            orgId,
            { ...attachment, storagePath },
            caption,
            undefined,
            undefined,
            clientMessageId,
          );
        } else {
          const uploaded = await Promise.all(
            attachments.map(async (attachment) => {
              const storagePath = buildMessageStoragePath(
                orgId,
                channelId,
                profileId,
                attachment.mimeType,
                attachment.name,
              );
              await uploadChannelFile(
                attachment.uri,
                storagePath,
                attachment.mimeType,
                attachment.base64,
              );
              return { ...attachment, storagePath };
            }),
          );

          if (uploaded.length === 1) {
            await sendFileMessage(
              channelId,
              profileId,
              orgId,
              uploaded[0],
              caption,
              undefined,
              undefined,
              clientMessageId,
            );
          } else {
            await sendFilesMessage(
              channelId,
              profileId,
              orgId,
              uploaded,
              caption,
              undefined,
              undefined,
              clientMessageId,
            );
          }
        }

        setPendingUploads((prev) => prev.filter((upload) => upload.id !== pendingId));
      } catch {
        setPendingUploads((prev) =>
          prev.map((upload) =>
            upload.id === pendingId ? { ...upload, failed: true } : upload,
          ),
        );
      }
    },
    [channelId, profileId, orgId, senderName],
  );

  const handleRetryUpload = useCallback(
    async (pendingId: string) => {
      const pending = pendingUploads.find((upload) => upload.id === pendingId);
      if (!pending || !channelId || !profileId || !orgId) return;
      if (pending.type === 'text') {
        await handleRetryTextSend(pendingId);
        return;
      }

      setPendingUploads((prev) =>
        prev.map((upload) =>
          upload.id === pendingId ? { ...upload, failed: false } : upload,
        ),
      );

      try {
        // Reuse the SAME clientMessageId from the original attempt (when
        // send-reliability generated one) — the server's idempotency check
        // then returns the already-created message instead of a duplicate
        // if the earlier attempt actually succeeded server-side.
        const { clientMessageId } = pending;
        if (pending.type === 'audio') {
          const attachment = pending.attachments[0];
          const storagePath = buildMessageStoragePath(
            orgId,
            channelId,
            profileId,
            attachment.mimeType,
            attachment.name,
          );
          await uploadChannelFile(
            attachment.uri,
            storagePath,
            attachment.mimeType,
            attachment.base64,
          );
          await sendFileMessage(
            channelId,
            profileId,
            orgId,
            { ...attachment, storagePath },
            pending.caption,
            undefined,
            undefined,
            clientMessageId,
          );
        } else {
          const uploaded = await Promise.all(
            pending.attachments.map(async (attachment) => {
              const storagePath = buildMessageStoragePath(
                orgId,
                channelId,
                profileId,
                attachment.mimeType,
                attachment.name,
              );
              await uploadChannelFile(
                attachment.uri,
                storagePath,
                attachment.mimeType,
                attachment.base64,
              );
              return { ...attachment, storagePath };
            }),
          );

          if (uploaded.length === 1) {
            await sendFileMessage(
              channelId,
              profileId,
              orgId,
              uploaded[0],
              pending.caption,
              undefined,
              undefined,
              clientMessageId,
            );
          } else {
            await sendFilesMessage(
              channelId,
              profileId,
              orgId,
              uploaded,
              pending.caption,
              undefined,
              undefined,
              clientMessageId,
            );
          }
        }

        setPendingUploads((prev) => prev.filter((upload) => upload.id !== pendingId));
      } catch {
        setPendingUploads((prev) =>
          prev.map((upload) =>
            upload.id === pendingId ? { ...upload, failed: true } : upload,
          ),
        );
      }
    },
    [pendingUploads, channelId, profileId, orgId, handleRetryTextSend],
  );

  // ── Delete message ──
  const handleDelete = useCallback(
    async (messageId: string) => {
      const removedMessage = removeMessage(messageId);
      try {
        await deleteMessage(messageId, orgId, profileId);
      } catch {
        if (removedMessage) {
          restoreMessage(removedMessage);
        }
        Alert.alert('Unable to delete message', 'Please try again.');
      }
    },
    [orgId, profileId, removeMessage, restoreMessage],
  );

  // ── Reaction toggle ──
  const handleReactionToggle = useCallback(
    async (messageId: string, emoji: string) => {
      await toggleReaction(messageId, emoji);
    },
    [toggleReaction],
  );

  const handleUnreadViewed = markChannelRead;
  if (!channelId) return null;

  const isOwnMessage = (msg: MessageVM) => msg.core.sender.ids.id === profileId;
  const emptyStateCopy = buildMobileChannelEmptyStateCopy({
    channelKind: 'dm',
    title: resolvedTopic,
  });

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.pageBg }]}
      edges={['top']}
    >
      <ConversationHeader
        title={resolvedTopic}
        subtitle={headerSubtitle}
        localTimeLabel={headerLocalTime}
        localTimeIcon={headerLocalTimeContext?.icon ?? 'clock'}
        kind="dm"
        avatarSeed={resolvedAvatarSeed}
        avatarThemeKey={resolvedAvatarThemeKey}
        avatarUrl={resolvedAvatarUrl || undefined}
        avatarRole={resolvedAvatarRole}
        presenceStatus={headerPresenceStatus}
        secondaryAvatarSeed={
          resolvedIsSupervised && resolvedSupervisedChildName
            ? resolvedSupervisedChildName
            : undefined
        }
        secondaryAvatarRole={resolvedIsSupervised ? 'child' : undefined}
        isReadOnly={resolvedIsSupervised}
        loading={isLoadingDmMeta && !dmMeta}
        onBack={() => router.back()}
        onMore={() => setInfoVisible(true)}
      />
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: colors.pageBg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {isLoading ? (
          <MessageBubblesSkeleton />
        ) : (
          <ThemedMessageList
            messages={messages ?? []}
            channelId={channelId ?? ''}
            currentProfileId={profileId}
            currentAccountId={accountId}
            pendingUploads={pendingUploads}
            onRetryUpload={handleRetryUpload}
            lastReadMessageId={channelReadState?.lastReadMessageId ?? null}
            lastReadAt={channelReadState?.lastReadAt ?? null}
            unreadCount={channelReadState?.unreadCount ?? 0}
            onLoadMore={loadMore}
            loading={false}
            refreshing={isRefetching}
            onRefresh={refreshConversation}
            onMessageLongPress={resolvedIsSupervised ? undefined : handleLongPress}
            onReactionToggle={resolvedIsSupervised ? undefined : handleReactionToggle}
            onThreadOpen={resolvedIsSupervised ? undefined : handleThreadOpen}
            onProfilePress={setProfileUser}
            isReadOnly={resolvedIsSupervised}
            onUnreadViewed={handleUnreadViewed}
            isScreenActive={isFocused}
            emptyTitle={emptyStateCopy.title}
            emptyDescription={emptyStateCopy.description}
            emptyIcon={emptyStateCopy.icon}
          />
        )}
        <TypingIndicator typingUsers={typingUsers} />
        {resolvedIsSupervised ? (
          <View
            style={[
              styles.supervisedNotice,
              { backgroundColor: colors.tealBg, borderTopColor: colors.teal },
            ]}
          >
            <Text
              style={{
                fontSize: 14,
                color: colors.teal,
                textAlign: 'center',
                fontWeight: '600',
              }}
            >
              You are viewing this conversation in read-only mode
            </Text>
          </View>
        ) : (
          <MessageInput
            onSend={handleSend}
            onSendAttachment={handleSendAttachment}
            placeholder={`Message ${resolvedTopic}…`}
            uploading={pendingUploads.some((upload) => !upload.failed)}
            onTypingChange={broadcastTyping}
            onTypingStop={broadcastTypingStop}
            replyTo={threadReplyTarget}
            onCancelReply={() => setThreadReplyTarget(null)}
            quoteReplyTo={quoteReplyTarget}
            onCancelQuoteReply={() => setQuoteReplyTarget(null)}
            enableDrafts={enableMessageDrafts}
            draftScope={
              orgId && profileId && accountId && channelId
                ? { accountId, profileId, orgId, channelId }
                : undefined
            }
            editingMessage={editingMessage}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            enableMentions={enableMobileMessageComposerParity}
            mentionCandidates={mentionCandidates}
            enableFormatting={enableMobileMessageComposerParity}
            enableSendReliability={enableMessageSendReliability}
          />
        )}
      </KeyboardAvoidingView>

      {/* Info sheet */}
      <ChannelInfoSheet
        visible={infoVisible}
        channelId={channelId ?? ''}
        title={resolvedTopic}
        subtitle={resolvedSubtitle}
        kind="dm"
        avatarSeed={resolvedAvatarSeed}
        avatarThemeKey={resolvedAvatarThemeKey}
        avatarRole={resolvedAvatarRole}
        messages={messages ?? []}
        onClose={() => setInfoVisible(false)}
        onProfilePress={(user) => {
          setInfoVisible(false);
          setProfileUser(user);
        }}
      />

      {/* Profile sheet */}
      <ProfileSheet
        visible={!!profileUser}
        user={profileUser}
        onClose={() => setProfileUser(null)}
        onMessagePress={
          enableMobileDirectMessageStart &&
          profileUser &&
          profileUser.ids.id !== profileId
            ? () => handleProfileMessagePress(profileUser)
            : undefined
        }
      />

      {/* Long-press actions sheet */}
      <MessageActionsSheet
        visible={actionsVisible}
        message={actionsMessage}
        isOwn={actionsMessage ? isOwnMessage(actionsMessage) : false}
        isReadOnly={resolvedIsSupervised}
        onClose={() => setActionsVisible(false)}
        onReact={handleReactionToggle}
        onThread={handleThreadOpen}
        onDelete={handleDelete}
        onQuoteReply={enableMessageReplyReference ? handleQuoteReply : undefined}
        onMarkUnread={enableMessageMarkUnread ? handleMarkUnread : undefined}
        isChannelUnread={isChannelUnread}
        enableEdit={enableMessageEdit}
        onEdit={handleEditMessage}
      />

      {/* Push notification nudge */}
      <PushNudgeSheet
        visible={isNudgeVisible}
        variant={nudgeVariant}
        onEnable={handleNudgeEnable}
        onOpenSettings={handleNudgeOpenSettings}
        onDismiss={handleNudgeDismiss}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  supervisedNotice: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
});
