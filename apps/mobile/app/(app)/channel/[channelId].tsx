import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MessageCircle, CalendarDays } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { MessageMentionVM, MessageVM, UserProfileVM } from '@iconicedu/shared-types';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import { useMessages } from '@/hooks/use-messages';
import { useSpaceSessions } from '@/hooks/use-space-sessions';
import {
  sendTextMessage,
  sendFileMessage,
  sendFilesMessage,
  editTextMessage,
  uploadChannelFile,
  buildMessageStoragePath,
  deleteMessage,
  fetchChannelMetaByChannelId,
  fetchChannelMembers,
  fetchChannelReadState,
  ensureDirectMessageChannelForProfiles,
  markChannelUnread,
  queryKeys,
} from '@/lib/api/queries';
import type { AttachmentPayload } from '@/components/messages/attachment-sheet';
import type { PendingUpload } from '@/components/messages/pending-message-row';
import { useTheme } from '@/providers/theme-provider';
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
import { SpaceSessionsTab } from '@/components/messages/space-sessions-tab';
import { resolveChannelTopicIconKey } from '@/lib/learning-space-icons';
import { buildMobileChannelEmptyStateCopy } from '@/lib/message-empty-state';
import { reportMobileObservedError } from '@/lib/analytics/report-error';
import { useMarkRead } from '@/hooks/use-mark-read';
import { applyOptimisticChannelManualUnread } from '@/lib/messages/apply-optimistic-channel-read-state';
import { useMobileFeatureFlag } from '@/hooks/use-mobile-feature-flag';
import { mobileFeatureFlagKeys } from '@/lib/feature-flags';
import { getMentionCandidates } from '@/lib/messages/message-mentions';
import { usePushNudge } from '@/hooks/use-push-nudge';
import { PushNudgeSheet } from '@/components/notifications/push-nudge-sheet';
import { usePushConsent } from '@/providers/push-consent-provider';

type ChannelTab = 'messages' | 'sessions';

export default function ChannelConversationScreen() {
  const { channelId } = useLocalSearchParams<{
    channelId: string;
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

  const orgId = account?.org_id ?? '';
  const accountId =
    ((account as Record<string, unknown> | undefined)?.id as string) ?? '';
  const profileRecord = (profile as Record<string, unknown> | undefined) ?? undefined;
  const profileId = (profileRecord?.id as string | undefined) ?? '';
  const senderName =
    (profileRecord?.display_name as string | undefined)?.trim() ||
    (profileRecord?.first_name as string | undefined)?.trim() ||
    'Me';
  const currentProfileName =
    (profileRecord?.display_name as string | undefined)?.trim() ||
    [
      profileRecord?.first_name as string | undefined,
      profileRecord?.last_name as string | undefined,
    ]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    null;
  const profileKind = (profileRecord?.kind as string | undefined) ?? null;
  const { data: channelMeta, isLoading: isLoadingChannelMeta } = useQuery({
    queryKey: queryKeys.channelMeta(channelId ?? '', orgId, accountId),
    queryFn: () => fetchChannelMetaByChannelId(orgId, accountId, channelId ?? ''),
    enabled: !!channelId && !!orgId && !!accountId,
    staleTime: 5 * 60 * 1000,
  });
  const resolvedTitle = channelMeta?.topic ?? 'Channel';
  const resolvedSubtitle = channelMeta?.description?.trim() || null;
  const isSpaceChannel = channelMeta?.is_learning_space === true;
  const isSupportChannel = channelMeta?.is_support === true;
  const headerStudentProfiles = channelMeta?.student_profiles ?? [];
  const headerParticipantProfiles = channelMeta?.participant_profiles ?? [];
  const resolvedIconKey = isSupportChannel
    ? resolveChannelTopicIconKey(channelMeta?.icon_key ?? 'life-buoy')
    : (channelMeta?.icon_key ?? null);
  const resolvedThemeKey = channelMeta?.themeKey ?? null;
  const resolvedMessageUiThemeKey = channelMeta?.messageUiThemeKey ?? 'feed';

  // Channel members — only needed for @mention autocomplete, so skip the
  // request entirely unless mention authoring is enabled.
  const { data: channelMembers } = useQuery({
    queryKey: ['channelMembers', orgId, channelId, profileId] as const,
    queryFn: () => fetchChannelMembers(orgId, channelId ?? '', profileId),
    enabled: enableMobileMessageComposerParity && !!orgId && !!channelId && !!profileId,
    staleTime: 60_000,
  });
  const mentionCandidates = useMemo(
    () => getMentionCandidates(channelMembers ?? [], profileId),
    [channelMembers, profileId],
  );

  const {
    data: messages,
    isLoading,
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

  const {
    schedules,
    isLoading: isLoadingSessions,
    error: sessionsError,
  } = useSpaceSessions(channelId ?? '', orgId);
  const liveSession = useMemo(() => {
    if (!schedules?.length) return null;
    const now = Date.now();
    return (
      schedules.find((schedule) => {
        const start = Date.parse(schedule.startAt);
        const end = Date.parse(schedule.endAt);
        return start <= now && end >= now && !!schedule.meetingLink;
      }) ?? null
    );
  }, [schedules]);
  const { data: channelReadState } = useQuery({
    queryKey: queryKeys.channelReadState(channelId ?? '', accountId),
    queryFn: () => fetchChannelReadState(channelId ?? '', accountId),
    enabled: !!channelId && !!accountId,
    staleTime: 30_000,
  });
  const { markChannelRead } = useMarkRead({
    orgId,
    profileId,
    accountId,
    channelId: channelId ?? '',
    profileKind,
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
  const isStaffReadOnly = false;

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<ChannelTab>('messages');
  const s = useMemo(() => makeStyles(colors), [colors]);
  const messageTheme = resolveMobileMessageUiTheme(resolvedMessageUiThemeKey);
  const ThemedMessageList = messageTheme.MessageList;
  const resolvedLiveJoinUrl =
    channelMeta?.liveSession?.joinUrl ??
    (channelMeta?.liveSession?.enabled ? (liveSession?.meetingLink ?? null) : null);

  // ── Info sheet state ──
  const [infoVisible, setInfoVisible] = useState(false);

  // ── Profile sheet state ──
  const [profileUser, setProfileUser] = useState<UserProfileVM | null>(null);

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
          profileKind,
        });
      } catch {
        Alert.alert('Unable to mark unread', 'Please try again.');
      }
    },
    [channelId, orgId, accountId, profileId, profileKind, queryClient],
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

      // Optimistic update so the edited text + "(edited)" indicator show
      // immediately; rolled back below on error.
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
          source: 'mobile.messages.channel.edit_text',
          message: 'Failed to edit channel message',
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

  // ── Pending uploads (WhatsApp-style optimistic UI) ──
  // Each pending item is shown in the message list immediately while the upload runs.
  // The realtime subscription invalidates the query once the DB row is created, replacing
  // the pending item with the real message — no manual refetch needed.
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);

  const {
    isVisible: isNudgeVisible,
    nudgeVariant,
    triggerNudge,
    handleEnable,
    handleOpenSettings,
    handleDismiss,
  } = usePushNudge();
  const { requestPushConsent } = usePushConsent();
  const scheduleConsentRequestedRef = useRef(false);

  const handlePushNotificationMoment = useCallback(async () => {
    const showedConsent = await requestPushConsent();
    if (!showedConsent) {
      await triggerNudge();
    }
  }, [requestPushConsent, triggerNudge]);

  useEffect(() => {
    if (activeTab !== 'sessions' || scheduleConsentRequestedRef.current) return;
    scheduleConsentRequestedRef.current = true;
    void handlePushNotificationMoment();
  }, [activeTab, handlePushNotificationMoment]);

  // ── Send message ──
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
            source: 'mobile.messages.channel.send_text',
            message: 'Failed to send channel message',
            context: { channelId, orgId, profileId },
          });
          setPendingUploads((prev) =>
            prev.map((p) => (p.id === clientMessageId ? { ...p, failed: true } : p)),
          );
          // Rethrow so the composer keeps the draft — the "Not sent" pending
          // row above is the error affordance now, not a one-shot Alert.
          throw error;
        }
        void handlePushNotificationMoment();
        return;
      }

      // Legacy path (send-reliability flag off) — unchanged pre-existing behavior.
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
          // Thread reply count lives in the threads table — refetch to update the pill.
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
          // Realtime subscription handles cache invalidation for non-thread messages.
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
          // Realtime subscription handles cache invalidation for non-thread messages.
        }
      } catch (error) {
        reportMobileObservedError({
          error,
          source: 'mobile.messages.channel.send_text',
          message: 'Failed to send channel message',
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
          source: 'mobile.messages.channel.retry_text',
          message: 'Failed to retry channel message send',
          context: { channelId, orgId, profileId, pendingId },
        });
        setPendingUploads((prev) =>
          prev.map((p) => (p.id === pendingId ? { ...p, failed: true } : p)),
        );
      }
    },
    [pendingUploads, channelId, profileId, orgId, refetch],
  );

  // ── Send attachment (WhatsApp-style: show locally first, upload in background) ──
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

      // 1. Add local preview immediately — user sees it right away (like WhatsApp)
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
          const a = attachments[0];
          const storagePath = buildMessageStoragePath(
            orgId,
            channelId,
            profileId,
            a.mimeType,
            a.name,
          );
          await uploadChannelFile(a.uri, storagePath, a.mimeType, a.base64);
          await sendFileMessage(
            channelId,
            profileId,
            orgId,
            { ...a, storagePath },
            caption,
            undefined,
            undefined,
            clientMessageId,
          );
        } else {
          const uploaded = await Promise.all(
            attachments.map(async (a) => {
              const storagePath = buildMessageStoragePath(
                orgId,
                channelId,
                profileId,
                a.mimeType,
                a.name,
              );
              await uploadChannelFile(a.uri, storagePath, a.mimeType, a.base64);
              return { ...a, storagePath };
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

        // 2. Remove pending entry — the realtime subscription will add the real message
        setPendingUploads((prev) => prev.filter((p) => p.id !== pendingId));
        void handlePushNotificationMoment();
      } catch (error) {
        reportMobileObservedError({
          error,
          source: 'mobile.messages.channel.send_attachment',
          message: 'Failed to send channel attachment',
          context: {
            channelId,
            orgId,
            profileId,
            pendingId,
            type,
            attachmentCount: attachments.length,
          },
        });
        // 3. Mark as failed — user sees a red error state on the pending item
        setPendingUploads((prev) =>
          prev.map((p) => (p.id === pendingId ? { ...p, failed: true } : p)),
        );
      }
    },
    [channelId, profileId, orgId, senderName, handlePushNotificationMoment],
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

  // ── Retry a failed upload (or a failed text send — see handleRetryTextSend) ──
  const handleRetryUpload = useCallback(
    async (pendingId: string) => {
      const pending = pendingUploads.find((p) => p.id === pendingId);
      if (!pending?.failed) return;
      if (pending.type === 'text') {
        await handleRetryTextSend(pendingId);
        return;
      }

      // Reset to uploading state so the spinner shows again
      setPendingUploads((prev) =>
        prev.map((p) => (p.id === pendingId ? { ...p, failed: false } : p)),
      );

      try {
        // Reuse the SAME clientMessageId from the original attempt (when
        // send-reliability generated one) — the server's idempotency check
        // then returns the already-created message instead of a duplicate
        // if the earlier attempt actually succeeded server-side.
        const { caption, clientMessageId } = pending;
        if (pending.type === 'audio') {
          const a = pending.attachments[0];
          const storagePath = buildMessageStoragePath(
            orgId,
            channelId!,
            profileId,
            a.mimeType,
            a.name,
          );
          await uploadChannelFile(a.uri, storagePath, a.mimeType, a.base64);
          await sendFileMessage(
            channelId!,
            profileId,
            orgId,
            { ...a, storagePath },
            caption,
            undefined,
            undefined,
            clientMessageId,
          );
        } else {
          const uploaded = await Promise.all(
            pending.attachments.map(async (a) => {
              const storagePath = buildMessageStoragePath(
                orgId,
                channelId!,
                profileId,
                a.mimeType,
                a.name,
              );
              await uploadChannelFile(a.uri, storagePath, a.mimeType, a.base64);
              return { ...a, storagePath };
            }),
          );
          if (uploaded.length === 1) {
            await sendFileMessage(
              channelId!,
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
              channelId!,
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
        setPendingUploads((prev) => prev.filter((p) => p.id !== pendingId));
      } catch (error) {
        reportMobileObservedError({
          error,
          source: 'mobile.messages.channel.retry_upload',
          message: 'Failed to retry channel attachment upload',
          context: {
            channelId,
            orgId,
            profileId,
            pendingId,
            type: pending.type,
            attachmentCount: pending.attachments.length,
          },
        });
        setPendingUploads((prev) =>
          prev.map((p) => (p.id === pendingId ? { ...p, failed: true } : p)),
        );
      }
    },
    [pendingUploads, channelId, profileId, orgId, handleRetryTextSend],
  );

  // ── Reaction toggle ──
  const handleReactionToggle = useCallback(
    async (messageId: string, emoji: string) => {
      await toggleReaction(messageId, emoji);
    },
    [toggleReaction],
  );

  const handleUnreadViewed = markChannelRead;
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
  const emptyStateCopy = buildMobileChannelEmptyStateCopy({
    channelKind: isSpaceChannel
      ? 'learning-space'
      : isSupportChannel
        ? 'support'
        : 'generic',
    currentUserKind: (profileRecord?.kind as string | null | undefined) ?? null,
    studentNames: headerStudentProfiles.map((student) => student.name),
  });
  const isOwnMessage = (msg: MessageVM) => msg.core.sender.ids.id === profileId;

  if (!channelId) return null;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.pageBg }]} edges={['top']}>
      <ConversationHeader
        title={resolvedTitle}
        subtitle={resolvedSubtitle}
        studentProfiles={headerStudentProfiles}
        participantProfiles={headerParticipantProfiles}
        currentProfileName={currentProfileName}
        currentProfileKind={profileKind}
        kind={isSpaceChannel ? 'space' : 'channel'}
        iconKey={resolvedIconKey}
        themeKey={resolvedThemeKey}
        isReadOnly={isStaffReadOnly}
        loading={isLoadingChannelMeta && !channelMeta}
        onBack={() => router.back()}
        onMore={() => setInfoVisible(true)}
        liveJoinUrl={resolvedLiveJoinUrl}
        onJoinPress={() => void handlePushNotificationMoment()}
      />

      {/* Tab bar: Messages | Sessions — only shown for class channels */}
      {isSpaceChannel && (
        <View style={[s.tabBar, { borderBottomColor: colors.border }]}>
          {(['messages', 'sessions'] as ChannelTab[]).map((tab) => {
            const isActive = activeTab === tab;
            const color = isActive ? colors.teal : colors.textMuted;
            return (
              <TouchableOpacity
                key={tab}
                style={[s.tabItem, isActive && { borderBottomColor: colors.teal }]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                {tab === 'messages' ? (
                  <MessageCircle size={16} color={color} />
                ) : (
                  <CalendarDays size={16} color={color} />
                )}
                <Text style={[s.tabLabel, { color }]}>
                  {tab === 'messages' ? 'Messages' : 'Sessions'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Sessions tab */}
      {activeTab === 'sessions' ? (
        <View style={[s.flex, { backgroundColor: colors.pageBg }]}>
          <SpaceSessionsTab
            schedules={schedules}
            isLoading={isLoadingSessions}
            error={sessionsError}
          />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={[s.flex, { backgroundColor: colors.pageBg }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ThemedMessageList
            messages={messages ?? []}
            channelId={channelId ?? ''}
            currentProfileId={profileId}
            currentAccountId={accountId}
            lastReadMessageId={channelReadState?.lastReadMessageId ?? null}
            lastReadAt={channelReadState?.lastReadAt ?? null}
            unreadCount={channelReadState?.unreadCount ?? 0}
            onLoadMore={loadMore}
            loading={isLoading}
            refreshing={isRefetching}
            onRefresh={refreshConversation}
            onMessageLongPress={isStaffReadOnly ? undefined : handleLongPress}
            onReactionToggle={isStaffReadOnly ? undefined : handleReactionToggle}
            onThreadOpen={isStaffReadOnly ? undefined : handleThreadOpen}
            onProfilePress={setProfileUser}
            pendingUploads={pendingUploads}
            onRetryUpload={handleRetryUpload}
            isReadOnly={isStaffReadOnly}
            onUnreadViewed={handleUnreadViewed}
            onSendAnnotation={(attachment) => {
              void handleSendAttachment([attachment]);
            }}
            isScreenActive={isFocused && activeTab === 'messages'}
            emptyTitle={emptyStateCopy.title}
            emptyDescription={emptyStateCopy.description}
            emptyIcon={emptyStateCopy.icon}
          />
          <TypingIndicator typingUsers={typingUsers} />
          <MessageInput
            onSend={handleSend}
            onSendAttachment={handleSendAttachment}
            placeholder={`Message ${isSpaceChannel ? resolvedTitle : `#${resolvedTitle}`}…`}
            onTypingChange={broadcastTyping}
            onTypingStop={broadcastTypingStop}
            replyTo={threadReplyTarget}
            onCancelReply={() => setThreadReplyTarget(null)}
            quoteReplyTo={quoteReplyTarget}
            onCancelQuoteReply={() => setQuoteReplyTarget(null)}
            uploading={pendingUploads.some((p) => !p.failed)}
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
        </KeyboardAvoidingView>
      )}

      {/* Info sheet */}
      <ChannelInfoSheet
        visible={infoVisible}
        channelId={channelId ?? ''}
        title={resolvedTitle}
        subtitle={resolvedSubtitle}
        kind={isSpaceChannel ? 'space' : 'channel'}
        iconKey={resolvedIconKey}
        themeKey={resolvedThemeKey}
        messages={messages ?? []}
        liveJoinUrl={resolvedLiveJoinUrl}
        onJoinPress={() => void handlePushNotificationMoment()}
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
        isReadOnly={isStaffReadOnly}
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
        onEnable={handleEnable}
        onOpenSettings={handleOpenSettings}
        onDismiss={handleDismiss}
      />
    </SafeAreaView>
  );
}

function makeStyles(_colors: {
  border: string;
  teal: string;
  textMuted: string;
  pageBg: string;
}) {
  return StyleSheet.create({
    safe: { flex: 1 },
    flex: { flex: 1 },
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
      paddingVertical: 11,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabLabel: {
      fontSize: 14,
      fontWeight: '600',
    },
  });
}
