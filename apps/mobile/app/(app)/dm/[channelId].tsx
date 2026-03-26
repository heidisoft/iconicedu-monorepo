import React, { useState, useCallback } from 'react';
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
import type { MessageVM } from '@iconicedu/shared-types';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import { useMessages } from '@/hooks/use-messages';
import { sendTextMessage, deleteMessage, markChannelReadState } from '@/lib/api/queries';
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
import { MessageBubblesSkeleton } from '@/components/skeletons';

export default function DmConversationScreen() {
  const {
    channelId,
    topic,
    avatarSeed,
    avatarUrl,
    avatarRole,
    avatarTimezone,
    subtitle,
    isSupervisedReadOnly,
    supervisedChildName,
    secondaryAvatarRole,
  } = useLocalSearchParams<{
    channelId: string;
    topic?: string;
    avatarSeed?: string;
    avatarUrl?: string;
    avatarRole?: string;
    avatarTimezone?: string;
    subtitle?: string;
    isSupervisedReadOnly?: string;
    supervisedChildName?: string;
    secondaryAvatarRole?: string;
  }>();

  const isSupervised = isSupervisedReadOnly === '1';
  const router = useRouter();
  const isFocused = useIsFocused();
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
    avatarSeed ? [avatarSeed] : [],
  );
  const headerPresenceStatus = avatarSeed
    ? (presenceByProfileId.get(avatarSeed) ?? null)
    : null;
  const headerPresenceSummary = useProfilePresenceSummary(orgId, avatarSeed ?? '');

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
        return timeText ? `${timeText} (Local time)` : null;
      })();

  const handleSubtitlePress = useCallback(() => {
    const tz = avatarTimezone?.trim();
    if (!tz || isSupervised) return;
    Alert.alert(
      'Local time',
      'You are seeing their current local time here, based on the timezone saved on their profile.',
    );
  }, [avatarTimezone, isSupervised]);

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

  // ── Info sheet state ──
  const [infoVisible, setInfoVisible] = useState(false);

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
    },
    [channelId, profileId, orgId, threadReplyTarget, refetch],
  );

  // ── Delete message ──
  const handleDelete = useCallback(async (messageId: string) => {
    await deleteMessage(messageId);
  }, []);

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

  const isOwnMessage = (msg: MessageVM) => msg.core.sender.ids.id === profileId;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.pageBg }]}
      edges={['top']}
    >
      <ConversationHeader
        title={topic ?? 'Direct Message'}
        subtitle={headerSubtitle}
        onSubtitlePress={headerLocalTime ? handleSubtitlePress : null}
        localTimeLabel={headerLocalTime}
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
            currentProfileId={profileId}
            currentAccountId={accountId}
            onLoadMore={loadMore}
            loading={false}
            refreshing={isRefetching}
            onRefresh={refetch}
            onMessageLongPress={isSupervised ? undefined : handleLongPress}
            onReactionToggle={isSupervised ? undefined : handleReactionToggle}
            onThreadOpen={isSupervised ? undefined : handleThreadOpen}
            isReadOnly={isSupervised}
            onUnreadViewed={handleUnreadViewed}
            isScreenActive={isFocused}
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
            placeholder={`Message ${topic ?? ''}…`}
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
