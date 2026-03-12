import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MessageVM } from '@iconicedu/shared-types';
import { useAccount } from '@/hooks/use-account';
import { useMessages } from '@/hooks/use-messages';
import { sendTextMessage, deleteMessage, markChannelReadState } from '@/lib/api/queries';
import { useTheme } from '@/providers/theme-provider';
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
    subtitle,
    isSupervisedReadOnly,
    supervisedChildName,
  } = useLocalSearchParams<{
    channelId: string;
    topic?: string;
    avatarSeed?: string;
    avatarUrl?: string;
    subtitle?: string;
    isSupervisedReadOnly?: string;
    supervisedChildName?: string;
  }>();

  const isSupervised = isSupervisedReadOnly === '1';
  const headerSubtitle = isSupervised
    ? supervisedChildName
      ? `Supervising ${supervisedChildName}'s conversation`
      : 'Supervised Inbox'
    : (subtitle ?? 'Direct Message');
  const router = useRouter();
  const isFocused = useIsFocused();
  const { data: account } = useAccount();
  const { colors } = useTheme();

  const orgId = account?.org_id ?? '';
  const accountId =
    ((account as Record<string, unknown> | undefined)?.id as string) ?? '';
  // Profile is joined in fetchUserAccount — no extra round-trip needed
  const profileArr = (account as Record<string, unknown> | undefined)?.profile as Array<{
    id: string;
    display_name: string | null;
    first_name: string | null;
  }> | null;
  const profileId = profileArr?.[0]?.id ?? '';
  const senderName =
    profileArr?.[0]?.display_name?.trim() || profileArr?.[0]?.first_name?.trim() || 'Me';

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
        kind="dm"
        avatarSeed={avatarSeed}
        avatarUrl={avatarUrl || undefined}
        secondaryAvatarSeed={
          isSupervised && supervisedChildName ? supervisedChildName : undefined
        }
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
        title={topic ?? 'Direct Message'}
        subtitle={subtitle}
        kind="dm"
        avatarSeed={avatarSeed}
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
