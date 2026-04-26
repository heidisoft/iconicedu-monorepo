import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import { useMessages } from '@/hooks/use-messages';
import { useSpaceSessions } from '@/hooks/use-space-sessions';
import {
  sendTextMessage,
  sendFileMessage,
  sendFilesMessage,
  uploadChannelFile,
  buildMessageStoragePath,
  fetchIsChannelMember,
  fetchSpaceChannelMetaByChannelId,
  fetchChannelReadState,
  deleteMessage,
  queryKeys,
} from '@/lib/api/queries';
import { useTheme } from '@/providers/theme-provider';
import { MessageList } from '@/components/messages/message-list';
import { MessageInput } from '@/components/messages/message-input';
import { TypingIndicator } from '@/components/messages/typing-indicator';
import { ConversationHeader } from '@/components/messages/conversation-header';
import { MessageActionsSheet } from '@/components/messages/message-actions-sheet';
import { ChannelInfoSheet } from '@/components/messages/channel-info-sheet';
import { ProfileSheet } from '@/components/messages/profile-sheet';
import { ReadOnlyNotice } from '@/components/messages/read-only-notice';
import { SpaceSessionsTab } from '@/components/messages/space-sessions-tab';
import type { AttachmentPayload } from '@/components/messages/attachment-sheet';
import { buildMobileChannelEmptyStateCopy } from '@/lib/message-empty-state';
import { reportMobileObservedError } from '@/lib/analytics/report-error';
import type { MessageVM, UserProfileVM } from '@iconicedu/shared-types';
import { useMarkRead } from '@/hooks/use-mark-read';

type PendingUpload = {
  id: string;
  type: 'image' | 'file' | 'audio';
  attachments: AttachmentPayload[];
  senderName: string;
  createdAt: string;
  caption?: string;
  failed?: boolean;
};

type SpaceTab = 'messages' | 'sessions';

export default function SpaceDetailScreen() {
  const { channelId, topic, iconKey, themeKey, subtitle, tab, isStaffObserverReadOnly } =
    useLocalSearchParams<{
      channelId: string;
      topic?: string;
      iconKey?: string;
      themeKey?: string;
      subtitle?: string;
      tab?: string;
      isStaffObserverReadOnly?: string;
    }>();
  const router = useRouter();
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const { colors } = useTheme();

  const orgId = account?.org_id ?? '';
  const accountId =
    ((account as Record<string, unknown> | undefined)?.id as string) ?? '';
  const profileId =
    ((profile as Record<string, unknown> | undefined)?.id as string) ?? '';
  const currentProfileName =
    (
      (profile as Record<string, unknown> | undefined)?.display_name as string | undefined
    )?.trim() ||
    [
      (profile as Record<string, unknown> | undefined)?.first_name as string | undefined,
      (profile as Record<string, unknown> | undefined)?.last_name as string | undefined,
    ]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    null;
  const profileKind =
    ((profile as Record<string, unknown> | undefined)?.kind as string | undefined) ??
    null;
  const senderName =
    ((
      (profile as Record<string, unknown> | undefined)?.display_name as string | undefined
    )?.trim() ||
      (
        (profile as Record<string, unknown> | undefined)?.first_name as string | undefined
      )?.trim()) ??
    'Me';
  const shouldCheckStaffReadOnly =
    profileKind === 'staff' && !!channelId && !!profileId && !!orgId;
  const initialStaffReadOnly = isStaffObserverReadOnly === '1';

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
  } = useMessages(channelId ?? '', profileId, accountId, senderName, orgId);
  const { data: spaceMeta, isLoading: isLoadingMeta } = useQuery({
    queryKey: queryKeys.spaceChannelMeta(channelId ?? ''),
    queryFn: () => fetchSpaceChannelMetaByChannelId(channelId ?? ''),
    enabled: !!channelId,
    staleTime: 5 * 60 * 1000,
  });
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
  const { data: isChannelMember = true } = useQuery({
    queryKey: queryKeys.channelMembership(orgId, channelId ?? '', profileId),
    queryFn: () => fetchIsChannelMember(orgId, channelId ?? '', profileId),
    enabled: shouldCheckStaffReadOnly,
    initialData: initialStaffReadOnly ? false : undefined,
    staleTime: 30_000,
  });
  useEffect(() => {
    if (!isFocused || !channelId || !orgId) return;
    void refreshConversation();
  }, [channelId, isFocused, orgId, refreshConversation]);
  const isStaffReadOnly =
    profileKind === 'staff' && (initialStaffReadOnly || !isChannelMember);

  const {
    schedules,
    isLoading: isLoadingSessions,
    error: sessionsError,
  } = useSpaceSessions(channelId ?? '', orgId);

  // ── Live session detection — mirrors web channel.context?.liveSession?.enabled check ──
  const liveSession = useMemo(() => {
    if (!schedules?.length) return null;
    const now = Date.now();
    return (
      schedules.find((s) => {
        const start = Date.parse(s.startAt);
        const end = Date.parse(s.endAt);
        return start <= now && end >= now && !!s.meetingLink;
      }) ?? null
    );
  }, [schedules]);

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<SpaceTab>(
    tab === 'sessions' ? 'sessions' : 'messages',
  );

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

  // ── Thread reply target ──
  const [threadReplyTarget, setThreadReplyTarget] = useState<MessageVM | null>(null);

  const handleThreadOpen = useCallback((msg: MessageVM) => {
    setThreadReplyTarget(msg);
  }, []);

  // ── Reaction toggle ──
  const handleReactionToggle = useCallback(
    async (messageId: string, emoji: string) => {
      await toggleReaction(messageId, emoji);
    },
    [toggleReaction],
  );

  // ── Delete message ──
  const handleDelete = useCallback(
    async (messageId: string) => {
      await deleteMessage(messageId, orgId, profileId);
    },
    [orgId, profileId],
  );

  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!channelId || !profileId || !orgId) return;
      try {
        if (threadReplyTarget) {
          const threadId = threadReplyTarget.social?.thread?.ids.id;
          await sendTextMessage(
            channelId,
            profileId,
            orgId,
            text,
            threadReplyTarget.ids.id,
            threadId,
          );
          setThreadReplyTarget(null);
          void refetch();
        } else {
          await sendTextMessage(channelId, profileId, orgId, text);
        }
      } catch (error) {
        reportMobileObservedError({
          error,
          source: 'mobile.messages.spaces.send_text',
          message: 'Failed to send space message',
          context: { channelId, orgId, profileId },
        });
        Alert.alert(
          'Failed to send',
          error instanceof Error
            ? error.message
            : 'Something went wrong. Please try again.',
        );
      }
    },
    [channelId, profileId, orgId, threadReplyTarget, refetch],
  );

  const handleSendAttachment = useCallback(
    async (attachments: AttachmentPayload[], caption?: string) => {
      if (!channelId || !profileId || !orgId || !attachments.length) return;

      const type: PendingUpload['type'] =
        attachments[0].mimeType === 'audio/mp4'
          ? 'audio'
          : attachments[0].mimeType.startsWith('image/')
            ? 'image'
            : 'file';

      const pendingId = `pending-${Date.now()}`;

      setPendingUploads((prev) => [
        ...prev,
        {
          id: pendingId,
          type,
          attachments,
          senderName,
          createdAt: new Date().toISOString(),
          caption,
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
            await sendFileMessage(channelId, profileId, orgId, uploaded[0], caption);
          } else {
            await sendFilesMessage(channelId, profileId, orgId, uploaded, caption);
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

  // ── Retry a failed upload ──
  const handleRetryUpload = useCallback(
    async (pendingId: string) => {
      const pending = pendingUploads.find((p) => p.id === pendingId);
      if (!pending?.failed) return;

      setPendingUploads((prev) =>
        prev.map((p) => (p.id === pendingId ? { ...p, failed: false } : p)),
      );

      try {
        const { caption } = pending;
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
            await sendFileMessage(channelId!, profileId, orgId, uploaded[0], caption);
          } else {
            await sendFilesMessage(channelId!, profileId, orgId, uploaded, caption);
          }
        }
        setPendingUploads((prev) => prev.filter((p) => p.id !== pendingId));
      } catch (error) {
        reportMobileObservedError({
          error,
          source: 'mobile.messages.spaces.retry_upload',
          message: 'Failed to retry space attachment upload',
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
    [pendingUploads, channelId, profileId, orgId],
  );

  const s = useMemo(() => makeStyles(colors), [colors]);

  const handleUnreadViewed = markChannelRead;
  if (!channelId) return null;

  const isOwnMessage = (msg: MessageVM) => msg.core.sender.ids.id === profileId;

  const resolvedTitle = spaceMeta?.title ?? topic ?? 'Class';
  const resolvedSubtitle = (spaceMeta?.subtitle ?? subtitle ?? '').trim() || null;
  const resolvedStudentProfiles = spaceMeta?.studentProfiles ?? [];
  const resolvedParticipantProfiles = spaceMeta?.participantProfiles ?? [];
  const resolvedIconKey = spaceMeta?.iconKey ?? iconKey ?? null;
  const resolvedThemeKey = spaceMeta?.themeKey ?? themeKey ?? null;
  const resolvedLiveJoinUrl =
    spaceMeta?.liveSession?.joinUrl ??
    (spaceMeta?.liveSession?.enabled ? (liveSession?.meetingLink ?? null) : null);
  const emptyStateCopy = buildMobileChannelEmptyStateCopy({
    channelKind: 'learning-space',
    currentUserKind:
      ((profile as Record<string, unknown> | undefined)?.kind as
        | string
        | null
        | undefined) ?? null,
    studentNames: resolvedStudentProfiles.map((student) => student.name),
  });

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.pageBg }]} edges={['top']}>
      <ConversationHeader
        title={resolvedTitle}
        kind="space"
        subtitle={resolvedSubtitle}
        studentProfiles={resolvedStudentProfiles}
        participantProfiles={resolvedParticipantProfiles}
        currentProfileName={currentProfileName}
        currentProfileKind={profileKind}
        iconKey={resolvedIconKey}
        themeKey={resolvedThemeKey}
        isReadOnly={isStaffReadOnly}
        loading={isLoadingMeta && !spaceMeta && !topic}
        onBack={() => router.back()}
        onMore={() => setInfoVisible(true)}
        liveJoinUrl={resolvedLiveJoinUrl}
      />

      {/* Tab bar: Messages | Sessions */}
      <View style={[s.tabBar, { borderBottomColor: colors.border }]}>
        {(['messages', 'sessions'] as SpaceTab[]).map((tab) => {
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

      {/* Content */}
      {activeTab === 'messages' ? (
        <KeyboardAvoidingView
          style={[s.flex, { backgroundColor: colors.pageBg }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <MessageList
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
            isScreenActive={isFocused && activeTab === 'messages'}
            emptyTitle={emptyStateCopy.title}
            emptyDescription={emptyStateCopy.description}
            emptyIcon={emptyStateCopy.icon}
          />
          <TypingIndicator typingUsers={typingUsers} />
          {isStaffReadOnly ? (
            <ReadOnlyNotice />
          ) : (
            <MessageInput
              onSend={handleSend}
              onSendAttachment={handleSendAttachment}
              placeholder={`Message ${resolvedTitle}…`}
              onTypingChange={broadcastTyping}
              onTypingStop={broadcastTypingStop}
              replyTo={threadReplyTarget}
              onCancelReply={() => setThreadReplyTarget(null)}
              uploading={pendingUploads.some((upload) => !upload.failed)}
            />
          )}
        </KeyboardAvoidingView>
      ) : (
        <View style={[s.flex, { backgroundColor: colors.pageBg }]}>
          <SpaceSessionsTab
            schedules={schedules ?? []}
            isLoading={isLoadingSessions}
            error={sessionsError}
          />
        </View>
      )}

      {/* Info sheet */}
      <ChannelInfoSheet
        visible={infoVisible}
        channelId={channelId ?? ''}
        title={resolvedTitle}
        subtitle={resolvedSubtitle}
        kind="space"
        iconKey={resolvedIconKey}
        themeKey={resolvedThemeKey}
        messages={messages ?? []}
        onClose={() => setInfoVisible(false)}
      />

      {/* Profile sheet */}
      <ProfileSheet
        visible={!!profileUser}
        user={profileUser}
        onClose={() => setProfileUser(null)}
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
      />
    </SafeAreaView>
  );
}

const makeStyles = (_colors: { border: string; teal: string; textMuted: string }) =>
  StyleSheet.create({
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
      fontSize: 13,
      fontWeight: '600',
    },
  });
