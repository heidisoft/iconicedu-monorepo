import React, { useState, useCallback } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MessageVM } from '@iconicedu/shared-types';
import { useAccount } from '@/hooks/use-account';
import { useMessages } from '@/hooks/use-messages';
import { useTyping } from '@/hooks/use-typing';
import { sendTextMessage, deleteMessage } from '@/lib/api/queries';
import { useTheme } from '@/providers/theme-provider';
import { MessageList } from '@/components/messages/message-list';
import { MessageInput } from '@/components/messages/message-input';
import { TypingIndicator } from '@/components/messages/typing-indicator';
import { ConversationHeader } from '@/components/messages/conversation-header';
import { MessageActionsSheet } from '@/components/messages/message-actions-sheet';
import { ThreadSheet } from '@/components/messages/thread-sheet';
import { ChannelInfoSheet } from '@/components/messages/channel-info-sheet';

export default function DmConversationScreen() {
  const { channelId, topic, avatarSeed, subtitle } = useLocalSearchParams<{
    channelId: string;
    topic?: string;
    avatarSeed?: string;
    subtitle?: string;
  }>();
  const router = useRouter();
  const { data: account } = useAccount();
  const { colors } = useTheme();

  const orgId = account?.org_id ?? '';
  const accountId = (account as Record<string, unknown> | undefined)?.id as string ?? '';
  // Profile is joined in fetchUserAccount — no extra round-trip needed
  const profileArr = ((account as Record<string, unknown> | undefined)
    ?.profile as Array<{ id: string; display_name: string | null; first_name: string | null }> | null);
  const profileId = profileArr?.[0]?.id ?? '';
  const senderName =
    profileArr?.[0]?.display_name?.trim() ||
    profileArr?.[0]?.first_name?.trim() ||
    'Me';

  const {
    data: messages,
    isLoading,
    isRefetching,
    refetch,
    loadMore,
    toggleReaction,
  } = useMessages(channelId ?? '', profileId, accountId);

  const { typingUsers, broadcastTyping } = useTyping(
    channelId ?? '',
    senderName,
    profileId,
  );

  // ── Info sheet state ──
  const [infoVisible, setInfoVisible] = useState(false);

  // ── Long-press actions sheet state ──
  const [actionsMessage, setActionsMessage] = useState<MessageVM | null>(null);
  const [actionsVisible, setActionsVisible] = useState(false);

  const handleLongPress = useCallback((msg: MessageVM) => {
    setActionsMessage(msg);
    setActionsVisible(true);
  }, []);

  // ── Thread sheet state ──
  const [threadMessage, setThreadMessage] = useState<MessageVM | null>(null);
  const [threadVisible, setThreadVisible] = useState(false);

  const handleThreadOpen = useCallback((msg: MessageVM) => {
    setThreadMessage(msg);
    setThreadVisible(true);
  }, []);

  // ── Send message ──
  const handleSend = useCallback(
    async (text: string, threadParentId?: string, threadId?: string) => {
      if (!channelId || !profileId || !orgId) return;
      await sendTextMessage(channelId, profileId, orgId, text, threadParentId, threadId);
    },
    [channelId, profileId, orgId],
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

  if (!channelId) return null;

  const isOwnMessage = (msg: MessageVM) => msg.core.sender.ids.id === profileId;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.pageBg }]} edges={['top']}>
      <ConversationHeader
        title={topic ?? 'Direct Message'}
        subtitle={subtitle ?? 'Direct Message'}
        kind="dm"
        avatarSeed={avatarSeed}
        onBack={() => router.back()}
        onMore={() => setInfoVisible(true)}
      />
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: colors.pageBg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <MessageList
          messages={messages ?? []}
          currentProfileId={profileId}
          currentAccountId={accountId}
          onLoadMore={loadMore}
          loading={isLoading}
          refreshing={isRefetching}
          onRefresh={refetch}
          onMessageLongPress={handleLongPress}
          onReactionToggle={handleReactionToggle}
          onThreadOpen={handleThreadOpen}
        />
        <TypingIndicator typingUsers={typingUsers} />
        <MessageInput
          onSend={handleSend}
          placeholder={`Message ${topic ?? ''}…`}
          onTypingChange={broadcastTyping}
        />
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
        onClose={() => setActionsVisible(false)}
        onReact={handleReactionToggle}
        onThread={handleThreadOpen}
        onDelete={handleDelete}
      />

      {/* Thread sheet */}
      <ThreadSheet
        visible={threadVisible}
        parentMessage={threadMessage}
        currentProfileId={profileId}
        currentAccountId={accountId}
        onClose={() => setThreadVisible(false)}
        onSend={handleSend}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
});
