import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MessageVM } from '@iconicedu/shared-types';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
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
import { DEMO_MESSAGE_MAP, DEMO_PROFILE_ID, DEMO_RILEY_PROFILE, DEMO_ORG_ID } from '@/lib/dummy-messages';

export default function ChannelConversationScreen() {
  const { channelId, topic } = useLocalSearchParams<{ channelId: string; topic?: string }>();
  const router = useRouter();
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const { colors } = useTheme();

  const isDemo = channelId?.startsWith('demo-') ?? false;

  const profileId = isDemo
    ? DEMO_PROFILE_ID
    : ((profile as Record<string, unknown> | undefined)?.id as string ?? '');
  const orgId = isDemo ? DEMO_ORG_ID : (account?.org_id ?? '');
  const senderName =
    ((profile as Record<string, unknown> | undefined)?.display_name as string | undefined) ??
    ((profile as Record<string, unknown> | undefined)?.first_name as string | undefined) ??
    'Me';

  // ── Demo local messages state ──
  const [localMessages, setLocalMessages] = useState<MessageVM[]>(
    () => isDemo ? (DEMO_MESSAGE_MAP[channelId ?? ''] ?? []) : [],
  );

  // ── Real messages ──
  const {
    data: realMessages,
    isLoading,
    loadMore,
    toggleReaction,
  } = useMessages(isDemo ? '' : (channelId ?? ''), profileId);

  const messages = isDemo ? localMessages : (realMessages ?? []);

  // ── Typing indicator ──
  const { typingUsers, broadcastTyping } = useTyping(
    isDemo ? '' : (channelId ?? ''),
    senderName,
    profileId,
  );

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
    async (text: string) => {
      if (isDemo) {
        const newMsg = {
          ids: { id: `demo-msg-${Date.now()}`, orgId: DEMO_ORG_ID },
          core: {
            type: 'text',
            sender: DEMO_RILEY_PROFILE,
            createdAt: new Date().toISOString(),
            visibility: { type: 'all' },
          },
          social: { reactions: [] },
          state: {},
          content: { text },
        } as unknown as MessageVM;
        setLocalMessages((prev) => [...prev, newMsg]);
        return;
      }
      if (!channelId || !profileId || !orgId) return;
      await sendTextMessage(channelId, profileId, orgId, text);
    },
    [isDemo, channelId, profileId, orgId],
  );

  // ── Delete message ──
  const handleDelete = useCallback(async (messageId: string) => {
    if (isDemo) {
      setLocalMessages((prev) => prev.filter((m) => m.ids.id !== messageId));
      return;
    }
    await deleteMessage(messageId);
  }, [isDemo]);

  // ── Reaction toggle ──
  const handleReactionToggle = useCallback(
    async (messageId: string, emoji: string) => {
      if (isDemo) {
        setLocalMessages((prev) =>
          prev.map((msg) => {
            if (msg.ids.id !== messageId) return msg;
            const reactions = msg.social?.reactions ?? [];
            const existing = reactions.find((r) => r.emoji === emoji);
            const newReactions = existing
              ? reactions
                  .map((r) =>
                    r.emoji === emoji
                      ? { ...r, count: r.reactedByMe ? r.count - 1 : r.count + 1, reactedByMe: !r.reactedByMe }
                      : r,
                  )
                  .filter((r) => r.count > 0)
              : [...reactions, { emoji, count: 1, reactedByMe: true }];
            return { ...msg, social: { ...msg.social, reactions: newReactions } } as unknown as MessageVM;
          }),
        );
        return;
      }
      await toggleReaction(messageId, emoji);
    },
    [isDemo, toggleReaction],
  );

  if (!channelId) return null;

  const isOwnMessage = (msg: MessageVM) => msg.core.sender.ids.id === profileId;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.pageBg }]} edges={['top']}>
      <ConversationHeader
        title={topic ?? 'Channel'}
        kind="channel"
        onBack={() => router.back()}
      />
      <View style={[styles.flex, { backgroundColor: colors.pageBg }]}>
        <MessageList
          messages={messages}
          currentProfileId={profileId}
          onLoadMore={isDemo ? undefined : loadMore}
          loading={isDemo ? false : isLoading}
          onMessageLongPress={handleLongPress}
          onReactionToggle={handleReactionToggle}
          onThreadOpen={handleThreadOpen}
        />
        <TypingIndicator typingUsers={typingUsers} />
        <MessageInput
          onSend={handleSend}
          placeholder={`Message #${topic ?? ''}…`}
          onTypingChange={isDemo ? undefined : broadcastTyping}
        />
      </View>

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
