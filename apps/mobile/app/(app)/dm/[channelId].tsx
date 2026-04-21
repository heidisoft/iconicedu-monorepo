import React, { useState, useCallback, useEffect } from 'react';
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
import type { MessageVM, UserProfileVM } from '@iconicedu/shared-types';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import { useMessages } from '@/hooks/use-messages';
import {
  sendTextMessage,
  sendFileMessage,
  sendFilesMessage,
  uploadChannelFile,
  buildMessageStoragePath,
  deleteMessage,
  markChannelReadState,
  fetchChannelReadState,
  queryKeys,
} from '@/lib/api/queries';
import { useTheme } from '@/providers/theme-provider';
import {
  useOnlineProfileIds,
  useProfilePresenceSummary,
} from '@/hooks/use-online-profile-ids';
import { MessageList } from '@/components/messages/message-list';
import { MessageInput } from '@/components/messages/message-input';
import { TypingIndicator } from '@/components/messages/typing-indicator';
import { ConversationHeader } from '@/components/messages/conversation-header';
import { MessageActionsSheet } from '@/components/messages/message-actions-sheet';
import { ChannelInfoSheet } from '@/components/messages/channel-info-sheet';
import { ProfileSheet } from '@/components/messages/profile-sheet';
import { MessageBubblesSkeleton } from '@/components/skeletons';
import { buildMobileChannelEmptyStateCopy } from '@/lib/message-empty-state';
import type { AttachmentPayload } from '@/components/messages/attachment-sheet';
import type { PendingUpload } from '@/components/messages/pending-message-row';
import type { PresenceDisplayStatus } from '@/hooks/use-online-profile-ids';
import { applyOptimisticChannelReadState } from '@/lib/messages/apply-optimistic-channel-read-state';

const COUNTRY_LABELS: Record<string, string> = {
  LK: 'Sri Lanka',
  IN: 'India',
  AU: 'Australia',
  GB: 'United Kingdom',
  US: 'United States',
  CA: 'Canada',
  NZ: 'New Zealand',
  SG: 'Singapore',
  AE: 'UAE',
  SA: 'Saudi Arabia',
  PK: 'Pakistan',
  BD: 'Bangladesh',
  MY: 'Malaysia',
  KE: 'Kenya',
  NG: 'Nigeria',
  ZA: 'South Africa',
  FR: 'France',
  DE: 'Germany',
  TR: 'Turkey',
  BR: 'Brazil',
  JP: 'Japan',
  CN: 'China',
  PH: 'Philippines',
  OM: 'Oman',
  QA: 'Qatar',
};

type LocalTimeContext = {
  icon: 'clock' | 'morning' | 'day' | 'evening' | 'off-hours' | 'offline';
  descriptor: string | null;
  tooltipLabel: string | null;
};

export default function DmConversationScreen() {
  const {
    channelId,
    topic,
    avatarSeed,
    presenceProfileId,
    avatarUrl,
    avatarRole,
    avatarTimezone,
    avatarCity,
    avatarCountryCode,
    avatarCountryName,
    subtitle,
    isSupervisedReadOnly,
    supervisedChildName,
    secondaryAvatarRole,
  } = useLocalSearchParams<{
    channelId: string;
    topic?: string;
    avatarSeed?: string;
    presenceProfileId?: string;
    avatarUrl?: string;
    avatarRole?: string;
    avatarTimezone?: string;
    avatarCity?: string;
    avatarCountryCode?: string;
    avatarCountryName?: string;
    subtitle?: string;
    isSupervisedReadOnly?: string;
    supervisedChildName?: string;
    secondaryAvatarRole?: string;
  }>();

  const isSupervised = isSupervisedReadOnly === '1';
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
  const presenceByProfileId = useOnlineProfileIds(
    orgId,
    profileId,
    presenceProfileId ? [presenceProfileId] : [],
  );
  const headerPresenceStatus = presenceProfileId
    ? (presenceByProfileId.get(presenceProfileId) ?? null)
    : null;
  const headerPresenceSummary = useProfilePresenceSummary(orgId, presenceProfileId ?? '');

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

  const localTimeText = useCallback((timezone: string | undefined) => {
    const tz = timezone?.trim();
    if (!tz) return null;
    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: tz,
      }).format(new Date());
    } catch {
      return null;
    }
  }, []);

  const buildLocalTimeContext = useCallback(
    (
      timezone: string | undefined,
      city: string | undefined,
      countryCode: string | undefined,
      countryName: string | undefined,
      presenceStatus: PresenceDisplayStatus | null,
    ): LocalTimeContext | null => {
      const timeText = localTimeText(timezone);
      if (!timeText) return null;

      const tz = timezone?.trim();
      let hour: number | null = null;
      if (tz) {
        try {
          const hourText = new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            hour12: false,
            timeZone: tz,
          }).format(new Date());
          const parsedHour = Number.parseInt(hourText, 10);
          hour = Number.isFinite(parsedHour) ? parsedHour : null;
        } catch {
          hour = null;
        }
      }

      const normalizedCity = city?.trim() ?? '';
      const normalizedCountryName = countryName?.trim() ?? '';
      const normalizedCountryCode = countryCode?.trim().toUpperCase() ?? '';
      const normalizedCountry =
        normalizedCountryName ||
        (normalizedCountryCode ? (COUNTRY_LABELS[normalizedCountryCode] ?? '') : '');
      const locationLabel =
        normalizedCity && normalizedCountry
          ? `${normalizedCity}, ${normalizedCountry}`
          : normalizedCity || normalizedCountry || null;

      let icon: LocalTimeContext['icon'] = 'clock';
      let descriptor: string | null = null;

      if (presenceStatus === 'offline') {
        icon = 'offline';
        descriptor = 'They may be offline right now';
      } else if (hour !== null) {
        if (hour >= 5 && hour < 9) {
          icon = 'morning';
          descriptor = 'It is morning there';
        } else if (hour >= 9 && hour < 18) {
          icon = 'day';
          descriptor = 'It is daytime there';
        } else if (hour >= 18 && hour < 21) {
          icon = 'evening';
          descriptor = 'It is evening there';
        } else {
          icon = 'off-hours';
          descriptor = 'It may be off hours there';
        }
      }

      const tooltipLines = [`Current time: ${timeText}`];
      if (locationLabel) {
        tooltipLines.push(`Location: ${locationLabel}`);
      }
      if (descriptor) {
        tooltipLines.push(descriptor);
      }

      return {
        icon,
        descriptor,
        tooltipLabel: tooltipLines.join('\n'),
      };
    },
    [localTimeText],
  );

  const headerSubtitle = isSupervised
    ? supervisedChildName
      ? `Supervising ${supervisedChildName}'s conversation`
      : 'Supervised Inbox'
    : (() => {
        if (headerPresenceSummary.status === 'online') {
          return 'Available';
        }
        const relative = formatRelativeLastSeen(headerPresenceSummary.lastSeenAt);
        if (!relative) {
          return subtitle ?? 'Direct Message';
        }
        return `Last seen ${relative}`;
      })();
  const headerLocalTime = isSupervised
    ? null
    : (() => {
        const timeText = localTimeText(avatarTimezone);
        return timeText ? timeText : null;
      })();
  const headerLocalTimeContext = isSupervised
    ? null
    : buildLocalTimeContext(
        avatarTimezone,
        avatarCity,
        avatarCountryCode,
        avatarCountryName,
        headerPresenceStatus ?? headerPresenceSummary.status,
      );

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
  } = useMessages(channelId ?? '', profileId, accountId, senderName, orgId);
  const { data: channelReadState } = useQuery({
    queryKey: queryKeys.channelReadState(channelId ?? '', accountId),
    queryFn: () => fetchChannelReadState(channelId ?? '', accountId),
    enabled: !!channelId && !!accountId,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!isFocused || !channelId || !orgId) return;
    void refetch();
  }, [channelId, isFocused, orgId, refetch]);

  // ── Info sheet state ──
  const [infoVisible, setInfoVisible] = useState(false);

  // ── Profile sheet state ──
  const [profileUser, setProfileUser] = useState<UserProfileVM | null>(null);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);

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

  // ── Send message ──
  // When a thread reply target is active, route the message into that thread.
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
          // Refresh so the parent message's thread stats (reply count) update
          void refetch();
        } else {
          await sendTextMessage(channelId, profileId, orgId, text);
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

  const handleRetryUpload = useCallback(
    async (pendingId: string) => {
      const pending = pendingUploads.find((upload) => upload.id === pendingId);
      if (!pending || !channelId || !profileId || !orgId) return;

      setPendingUploads((prev) =>
        prev.map((upload) =>
          upload.id === pendingId ? { ...upload, failed: false } : upload,
        ),
      );

      try {
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
            );
          } else {
            await sendFilesMessage(
              channelId,
              profileId,
              orgId,
              uploaded,
              pending.caption,
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
    [pendingUploads, channelId, profileId, orgId],
  );

  // ── Delete message ──
  const handleDelete = useCallback(
    async (messageId: string) => {
      await deleteMessage(messageId, orgId, profileId);
    },
    [orgId, profileId],
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
        profileKind: (profileRecord?.kind as string | null | undefined) ?? null,
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
    [accountId, channelId, orgId, profileId, profileRecord?.kind, queryClient],
  );
  if (!channelId) return null;

  const isOwnMessage = (msg: MessageVM) => msg.core.sender.ids.id === profileId;
  const emptyStateCopy = buildMobileChannelEmptyStateCopy({
    channelKind: 'dm',
    title: topic ?? 'there',
  });

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.pageBg }]}
      edges={['top']}
    >
      <ConversationHeader
        title={topic ?? 'Direct Message'}
        subtitle={headerSubtitle}
        localTimeLabel={headerLocalTime}
        localTimeIcon={headerLocalTimeContext?.icon ?? 'clock'}
        kind="dm"
        avatarSeed={avatarSeed}
        avatarUrl={avatarUrl || undefined}
        avatarRole={avatarRole}
        presenceStatus={headerPresenceStatus}
        secondaryAvatarSeed={
          isSupervised && supervisedChildName ? supervisedChildName : undefined
        }
        secondaryAvatarRole={isSupervised ? (secondaryAvatarRole ?? 'child') : undefined}
        isReadOnly={isSupervised}
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
          <MessageList
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
            onRefresh={refetch}
            onMessageLongPress={isSupervised ? undefined : handleLongPress}
            onReactionToggle={isSupervised ? undefined : handleReactionToggle}
            onThreadOpen={isSupervised ? undefined : handleThreadOpen}
            onProfilePress={setProfileUser}
            isReadOnly={isSupervised}
            onUnreadViewed={handleUnreadViewed}
            isScreenActive={isFocused}
            emptyTitle={emptyStateCopy.title}
            emptyDescription={emptyStateCopy.description}
            emptyIcon={emptyStateCopy.icon}
          />
        )}
        <TypingIndicator typingUsers={typingUsers} />
        {isSupervised ? (
          <View
            style={[
              styles.supervisedNotice,
              { backgroundColor: colors.tealBg, borderTopColor: colors.teal },
            ]}
          >
            <Text
              style={{
                fontSize: 13,
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
            placeholder={`Message ${topic ?? ''}…`}
            uploading={pendingUploads.some((upload) => !upload.failed)}
            onTypingChange={broadcastTyping}
            onTypingStop={broadcastTypingStop}
            replyTo={threadReplyTarget}
            onCancelReply={() => setThreadReplyTarget(null)}
          />
        )}
      </KeyboardAvoidingView>

      {/* Info sheet */}
      <ChannelInfoSheet
        visible={infoVisible}
        channelId={channelId ?? ''}
        title={topic ?? 'Direct Message'}
        subtitle={subtitle}
        kind="dm"
        avatarSeed={avatarSeed}
        avatarRole={avatarRole}
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
        isReadOnly={isSupervised}
        onClose={() => setActionsVisible(false)}
        onReact={handleReactionToggle}
        onThread={handleThreadOpen}
        onDelete={handleDelete}
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
