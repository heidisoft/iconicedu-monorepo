import React, { useState, useCallback } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MessageVM } from '@iconicedu/shared-types';
import { useAccount } from '@/hooks/use-account';
import { useMessages } from '@/hooks/use-messages';
import { sendTextMessage, sendFileMessage, sendFilesMessage, uploadChannelFile, buildMessageStoragePath, deleteMessage } from '@/lib/api/queries';
import type { AttachmentPayload } from '@/components/messages/attachment-sheet';
import type { PendingUpload } from '@/components/messages/pending-message-row';
import { useTheme } from '@/providers/theme-provider';
import { MessageList } from '@/components/messages/message-list';
import { MessageInput } from '@/components/messages/message-input';
import { TypingIndicator } from '@/components/messages/typing-indicator';
import { ConversationHeader } from '@/components/messages/conversation-header';
import { MessageActionsSheet } from '@/components/messages/message-actions-sheet';
import { ChannelInfoSheet } from '@/components/messages/channel-info-sheet';

export default function ChannelConversationScreen() {
  const { channelId, topic, iconEmoji, subtitle } = useLocalSearchParams<{
    channelId: string;
    topic?: string;
    iconEmoji?: string;
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

  // ── Pending uploads (WhatsApp-style optimistic UI) ──
  // Each pending item is shown in the message list immediately while the upload runs.
  // The realtime subscription invalidates the query once the DB row is created, replacing
  // the pending item with the real message — no manual refetch needed.
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);

  // ── Send message ──
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
        // Thread reply count lives in the threads table — refetch to update the pill.
        void refetch();
      } else {
        await sendTextMessage(channelId, profileId, orgId, text);
        // Realtime subscription handles cache invalidation for non-thread messages.
      }
    },
    [channelId, profileId, orgId, threadReplyTarget, refetch],
  );

  // ── Send attachment (WhatsApp-style: show locally first, upload in background) ──
  const handleSendAttachment = useCallback(
    async (attachments: AttachmentPayload[], caption?: string) => {
      if (!channelId || !profileId || !orgId || !attachments.length) return;

      const type: PendingUpload['type'] =
        attachments[0].mimeType === 'audio/mp4' ? 'audio'
        : attachments[0].mimeType.startsWith('image/') ? 'image'
        : 'file';

      const pendingId = `pending-${Date.now()}`;

      // 1. Add local preview immediately — user sees it right away (like WhatsApp)
      setPendingUploads((prev) => [
        ...prev,
        { id: pendingId, type, attachments, senderName, createdAt: new Date().toISOString(), caption },
      ]);

      try {
        if (type === 'audio') {
          const a = attachments[0];
          const storagePath = buildMessageStoragePath(orgId, channelId, profileId, a.mimeType, a.name);
          await uploadChannelFile(a.uri, storagePath, a.mimeType, a.base64);
          await sendFileMessage(channelId, profileId, orgId, { ...a, storagePath }, caption);
        } else {
          const uploaded = await Promise.all(
            attachments.map(async (a) => {
              const storagePath = buildMessageStoragePath(orgId, channelId, profileId, a.mimeType, a.name);
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
      } catch {
        // 3. Mark as failed — user sees a red error state on the pending item
        setPendingUploads((prev) =>
          prev.map((p) => (p.id === pendingId ? { ...p, failed: true } : p)),
        );
      }
    },
    [channelId, profileId, orgId, senderName],
  );

  // ── Delete message ──
  const handleDelete = useCallback(async (messageId: string) => {
    await deleteMessage(messageId);
  }, []);

  // ── Retry a failed upload ──
  const handleRetryUpload = useCallback(async (pendingId: string) => {
    const pending = pendingUploads.find((p) => p.id === pendingId);
    if (!pending?.failed) return;

    // Reset to uploading state so the spinner shows again
    setPendingUploads((prev) => prev.map((p) => (p.id === pendingId ? { ...p, failed: false } : p)));

    try {
      const { caption } = pending;
      if (pending.type === 'audio') {
        const a = pending.attachments[0];
        const storagePath = buildMessageStoragePath(orgId, channelId!, profileId, a.mimeType, a.name);
        await uploadChannelFile(a.uri, storagePath, a.mimeType, a.base64);
        await sendFileMessage(channelId!, profileId, orgId, { ...a, storagePath }, caption);
      } else {
        const uploaded = await Promise.all(
          pending.attachments.map(async (a) => {
            const storagePath = buildMessageStoragePath(orgId, channelId!, profileId, a.mimeType, a.name);
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
    } catch {
      setPendingUploads((prev) => prev.map((p) => (p.id === pendingId ? { ...p, failed: true } : p)));
    }
  }, [pendingUploads, channelId, profileId, orgId]);

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
        title={topic ?? 'Channel'}
        subtitle={subtitle}
        kind="channel"
        iconEmoji={iconEmoji}
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
          pendingUploads={pendingUploads}
          onRetryUpload={handleRetryUpload}
        />
        <TypingIndicator typingUsers={typingUsers} />
        <MessageInput
          onSend={handleSend}
          onSendAttachment={handleSendAttachment}
          placeholder={`Message #${topic ?? ''}…`}
          onTypingChange={broadcastTyping}
          onTypingStop={broadcastTypingStop}
          replyTo={threadReplyTarget}
          onCancelReply={() => setThreadReplyTarget(null)}
          uploading={pendingUploads.some((p) => !p.failed)}
        />
      </KeyboardAvoidingView>

      {/* Info sheet */}
      <ChannelInfoSheet
        visible={infoVisible}
        title={topic ?? 'Channel'}
        subtitle={subtitle}
        kind="channel"
        iconEmoji={iconEmoji}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
});
