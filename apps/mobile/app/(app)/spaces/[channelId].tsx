import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MessageCircle, CalendarDays } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
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
  markChannelReadState,
  fetchSpaceChannelMetaByChannelId,
  fetchChannelReadState,
  queryKeys,
} from '@/lib/api/queries';
import { useTheme } from '@/providers/theme-provider';
import { MessageList } from '@/components/messages/message-list';
import { MessageInput } from '@/components/messages/message-input';
import { TypingIndicator } from '@/components/messages/typing-indicator';
import { ConversationHeader } from '@/components/messages/conversation-header';
import { ChannelInfoSheet } from '@/components/messages/channel-info-sheet';
import { SpaceSessionsTab } from '@/components/messages/space-sessions-tab';
import type { AttachmentPayload } from '@/components/messages/attachment-sheet';
import { buildMobileChannelEmptyStateCopy } from '@/lib/message-empty-state';

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
  const { channelId, topic, iconKey, themeKey, subtitle, tab } = useLocalSearchParams<{
    channelId: string;
    topic?: string;
    iconKey?: string;
    themeKey?: string;
    subtitle?: string;
    tab?: string;
  }>();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const { colors } = useTheme();

  const orgId = account?.org_id ?? '';
  const accountId =
    ((account as Record<string, unknown> | undefined)?.id as string) ?? '';
  const profileId =
    ((profile as Record<string, unknown> | undefined)?.id as string) ?? '';
  const senderName =
    ((
      (profile as Record<string, unknown> | undefined)?.display_name as string | undefined
    )?.trim() ||
      (
        (profile as Record<string, unknown> | undefined)?.first_name as string | undefined
      )?.trim()) ??
    'Me';

  const { data: messages, isLoading, loadMore } = useMessages(channelId ?? '');
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
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!channelId || !profileId || !orgId) return;
      await sendTextMessage(channelId, profileId, orgId, text);
    },
    [channelId, profileId, orgId],
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

  const s = useMemo(() => makeStyles(colors), [colors]);

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
      try {
        await markChannelReadState({
          orgId,
          accountId,
          profileId,
          channelId,
          lastReadMessageId,
        });
      } catch {
        // best effort read-state sync
      }
    },
    [accountId, channelId, orgId, profileId],
  );
  if (!channelId) return null;

  const resolvedTitle = spaceMeta?.title ?? topic ?? 'Class';
  const resolvedSubtitle = (spaceMeta?.subtitle ?? subtitle ?? '').trim() || null;
  const resolvedStudentProfiles = spaceMeta?.studentProfiles ?? [];
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
        iconKey={resolvedIconKey}
        themeKey={resolvedThemeKey}
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
        <View style={[s.flex, { backgroundColor: colors.pageBg }]}>
          <MessageList
            messages={messages ?? []}
            currentProfileId={profileId}
            currentAccountId={accountId}
            lastReadMessageId={channelReadState?.lastReadMessageId ?? null}
            unreadCount={channelReadState?.unreadCount ?? 0}
            onLoadMore={loadMore}
            loading={isLoading}
            pendingUploads={pendingUploads}
            onUnreadViewed={handleUnreadViewed}
            isScreenActive={isFocused && activeTab === 'messages'}
            emptyTitle={emptyStateCopy.title}
            emptyDescription={emptyStateCopy.description}
            emptyIcon={emptyStateCopy.icon}
          />
          <TypingIndicator typingUsers={[]} />
          <MessageInput
            onSend={handleSend}
            onSendAttachment={handleSendAttachment}
            placeholder={`Message ${resolvedTitle}…`}
            uploading={pendingUploads.some((upload) => !upload.failed)}
          />
        </View>
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
