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
import type { MessageVM, UserProfileVM } from '@iconicedu/shared-types';
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
  deleteMessage,
  markChannelReadState,
  fetchChannelReadState,
  fetchIsChannelMember,
  queryKeys,
} from '@/lib/api/queries';
import type { AttachmentPayload } from '@/components/messages/attachment-sheet';
import type { PendingUpload } from '@/components/messages/pending-message-row';
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
import { resolveChannelTopicIconKey } from '@/lib/learning-space-icons';
import { buildMobileChannelEmptyStateCopy } from '@/lib/message-empty-state';
import { reportMobileObservedError } from '@/lib/analytics/report-error';
import { applyOptimisticChannelReadState } from '@/lib/messages/apply-optimistic-channel-read-state';

type ChannelTab = 'messages' | 'sessions';

type HeaderStudentProfile = { name: string; themeKey?: string | null };
type HeaderParticipantProfile = {
  name: string;
  kind: 'educator' | 'guardian' | 'child' | 'staff' | 'system';
  themeKey?: string | null;
};

export default function ChannelConversationScreen() {
  const {
    channelId,
    topic,
    iconKey,
    themeKey,
    subtitle,
    studentProfiles,
    participantProfiles,
    isLearningSpace,
    purpose,
    isStaffObserverReadOnly,
  } = useLocalSearchParams<{
    channelId: string;
    topic?: string;
    iconKey?: string;
    themeKey?: string;
    subtitle?: string;
    studentProfiles?: string;
    participantProfiles?: string;
    isLearningSpace?: string;
    purpose?: string;
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
  const shouldCheckStaffReadOnly =
    profileKind === 'staff' &&
    purpose !== 'support' &&
    !!channelId &&
    !!profileId &&
    !!orgId;
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

  const {
    schedules,
    isLoading: isLoadingSessions,
    error: sessionsError,
  } = useSpaceSessions(channelId ?? '', orgId);
  const { data: channelReadState } = useQuery({
    queryKey: queryKeys.channelReadState(channelId ?? '', accountId),
    queryFn: () => fetchChannelReadState(channelId ?? '', accountId),
    enabled: !!channelId && !!accountId,
    staleTime: 30_000,
  });
  const { data: isChannelMember = true } = useQuery({
    queryKey: queryKeys.channelMembership(orgId, channelId ?? '', profileId),
    queryFn: () => fetchIsChannelMember(orgId, channelId ?? '', profileId),
    enabled: shouldCheckStaffReadOnly,
    initialData: initialStaffReadOnly ? false : undefined,
    staleTime: 30_000,
  });
  useEffect(() => {
    if (!isFocused || !channelId || !orgId) return;
    void refetch();
  }, [channelId, isFocused, orgId, refetch]);
  const isStaffReadOnly =
    profileKind === 'staff' &&
    purpose !== 'support' &&
    (initialStaffReadOnly || !isChannelMember);

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<ChannelTab>('messages');
  const s = useMemo(() => makeStyles(colors), [colors]);

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

  const handleThreadOpen = useCallback((msg: MessageVM) => {
    setThreadReplyTarget(msg);
  }, []);

  // ── Pending uploads (WhatsApp-style optimistic UI) ──
  // Each pending item is shown in the message list immediately while the upload runs.
  // The realtime subscription invalidates the query once the DB row is created, replacing
  // the pending item with the real message — no manual refetch needed.
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);

  // ── Send message ──
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
          // Thread reply count lives in the threads table — refetch to update the pill.
          void refetch();
        } else {
          await sendTextMessage(channelId, profileId, orgId, text);
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
      }
    },
    [channelId, profileId, orgId, threadReplyTarget, refetch],
  );

  // ── Send attachment (WhatsApp-style: show locally first, upload in background) ──
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
            await sendFileMessage(channelId, profileId, orgId, uploaded[0], caption);
          } else {
            await sendFilesMessage(channelId, profileId, orgId, uploaded, caption);
          }
        }

        // 2. Remove pending entry — the realtime subscription will add the real message
        setPendingUploads((prev) => prev.filter((p) => p.id !== pendingId));
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
    [channelId, profileId, orgId, senderName],
  );

  // ── Delete message ──
  const handleDelete = useCallback(
    async (messageId: string) => {
      await deleteMessage(messageId, orgId, profileId);
    },
    [orgId, profileId],
  );

  // ── Retry a failed upload ──
  const handleRetryUpload = useCallback(
    async (pendingId: string) => {
      const pending = pendingUploads.find((p) => p.id === pendingId);
      if (!pending?.failed) return;

      // Reset to uploading state so the spinner shows again
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
    [pendingUploads, channelId, profileId, orgId],
  );

  // ── Reaction toggle ──
  const handleReactionToggle = useCallback(
    async (messageId: string, emoji: string) => {
      await toggleReaction(messageId, emoji);
    },
    [toggleReaction],
  );

  const lastMarkedReadIdRef = React.useRef<string | null>(null);
  const handleUnreadViewed = useCallback(
    async (lastReadMessageId: string) => {
      if (!channelId || !orgId || !accountId || !profileId || !lastReadMessageId) {
        return;
      }
      if (lastMarkedReadIdRef.current === lastReadMessageId) {
        return;
      }
      lastMarkedReadIdRef.current = lastReadMessageId;
      applyOptimisticChannelReadState({
        queryClient,
        orgId,
        profileId,
        accountId,
        channelId,
        lastReadMessageId,
        profileKind,
      });
      try {
        await markChannelReadState({
          orgId,
          accountId,
          profileId,
          channelId,
          lastReadMessageId,
        });
      } catch {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.channelReadState(channelId, accountId),
        });
      }
    },
    [accountId, channelId, orgId, profileId, profileKind, queryClient],
  );
  const headerStudentProfiles = useMemo(() => {
    if (!studentProfiles) return [] as HeaderStudentProfile[];
    try {
      const parsed = JSON.parse(studentProfiles) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.flatMap((student) => {
        if (!student || typeof student !== 'object') return [];
        const { name, themeKey } = student as {
          name?: unknown;
          themeKey?: unknown;
        };
        return typeof name === 'string' && name.trim()
          ? [{ name, themeKey: typeof themeKey === 'string' ? themeKey : null }]
          : [];
      });
    } catch {
      return [];
    }
  }, [studentProfiles]);
  const headerParticipantProfiles = useMemo(() => {
    if (!participantProfiles) return [] as HeaderParticipantProfile[];
    try {
      const parsed = JSON.parse(participantProfiles) as unknown;
      if (!Array.isArray(parsed)) return [] as HeaderParticipantProfile[];
      return parsed.flatMap((value) => {
        if (!value || typeof value !== 'object') return [];
        const name =
          typeof (value as { name?: unknown }).name === 'string'
            ? (value as { name: string }).name.trim()
            : '';
        const candidateKind = (value as { kind?: unknown }).kind;
        if (
          !name ||
          (candidateKind !== 'educator' &&
            candidateKind !== 'guardian' &&
            candidateKind !== 'child' &&
            candidateKind !== 'staff' &&
            candidateKind !== 'system')
        ) {
          return [];
        }
        const kind: HeaderParticipantProfile['kind'] = candidateKind;
        return [
          {
            name,
            kind,
            themeKey:
              typeof (value as { themeKey?: unknown }).themeKey === 'string'
                ? ((value as { themeKey: string }).themeKey ?? null)
                : null,
          },
        ];
      });
    } catch {
      return [] as HeaderParticipantProfile[];
    }
  }, [participantProfiles]);
  const resolvedSubtitle = subtitle?.trim() || null;
  const isSpaceChannel = isLearningSpace === '1';
  const resolvedIconKey =
    purpose === 'support'
      ? resolveChannelTopicIconKey(iconKey ?? 'life-buoy')
      : (iconKey ?? null);
  const emptyStateCopy = buildMobileChannelEmptyStateCopy({
    channelKind: isSpaceChannel
      ? 'learning-space'
      : purpose === 'support'
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
        title={topic ?? 'Channel'}
        subtitle={resolvedSubtitle}
        studentProfiles={headerStudentProfiles}
        participantProfiles={headerParticipantProfiles}
        currentProfileName={currentProfileName}
        currentProfileKind={profileKind}
        kind={isSpaceChannel ? 'space' : 'channel'}
        iconKey={resolvedIconKey}
        themeKey={themeKey ?? null}
        isReadOnly={isStaffReadOnly}
        onBack={() => router.back()}
        onMore={() => setInfoVisible(true)}
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
          <MessageList
            messages={messages ?? []}
            channelId={channelId ?? ''}
            currentProfileId={profileId}
            currentAccountId={accountId}
            lastReadMessageId={channelReadState?.lastReadMessageId ?? null}
            unreadCount={channelReadState?.unreadCount ?? 0}
            onLoadMore={loadMore}
            loading={isLoading}
            refreshing={isRefetching}
            onRefresh={refetch}
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
          {isStaffReadOnly ? (
            <ReadOnlyNotice />
          ) : (
            <MessageInput
              onSend={handleSend}
              onSendAttachment={handleSendAttachment}
              placeholder={`Message ${isSpaceChannel ? (topic ?? 'Space') : `#${topic ?? ''}`}…`}
              onTypingChange={broadcastTyping}
              onTypingStop={broadcastTypingStop}
              replyTo={threadReplyTarget}
              onCancelReply={() => setThreadReplyTarget(null)}
              uploading={pendingUploads.some((p) => !p.failed)}
            />
          )}
        </KeyboardAvoidingView>
      )}

      {/* Info sheet */}
      <ChannelInfoSheet
        visible={infoVisible}
        channelId={channelId ?? ''}
        title={topic ?? 'Channel'}
        subtitle={resolvedSubtitle}
        kind={isSpaceChannel ? 'space' : 'channel'}
        iconKey={resolvedIconKey}
        themeKey={themeKey ?? null}
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
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
