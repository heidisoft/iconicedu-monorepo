'use client';

import type { MessagesRealtimeClient, MessageVM } from '@iconicedu/shared-types';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';

const MESSAGE_PAYLOAD_TABLES = [
  'message_text',
  'message_image',
  'message_file',
  'message_design_file_update',
  'message_payment_reminder',
  'message_event_reminder',
  'message_feedback_request',
  'message_lesson_assignment',
  'message_progress_update',
  'message_session_booking',
  'message_session_complete',
  'message_session_summary',
  'message_homework_submission',
  'message_link_preview',
  'message_audio_recording',
  'message_live_session_started',
  'message_reactions',
  'message_reaction_counts',
] as const;

const THREAD_TABLES = ['threads'] as const;

export function createSupabaseMessagesRealtimeClient(): MessagesRealtimeClient {
  const supabase = createSupabaseBrowserClient();
  const channelsById = new Map<string, ReturnType<typeof supabase.channel>>();

  return {
    subscribe: ({ orgId, channelId, onEvent }) => {
      // Clean up existing subscription if any
      const existing = channelsById.get(channelId);
      if (existing) {
        void existing.unsubscribe();
        channelsById.delete(channelId);
      }

      const channel = supabase.channel(`messages:${channelId}`);
      channelsById.set(channelId, channel);
      const pending = new Map<string, Promise<void>>();
      const queued = new Map<string, 'added' | 'updated'>();

      const fetchMessage = async (messageId: string, type: 'added' | 'updated') => {
        if (!messageId) return;

        if (pending.has(messageId)) {
          queued.set(messageId, type);
          await pending.get(messageId);
          return;
        }

        const task = (async () => {
          let nextType: 'added' | 'updated' | undefined = type;
          while (nextType) {
            const currentType = nextType;
            nextType = undefined;

            const response = await fetch(`/api/messages/detail?messageId=${messageId}`);
            if (response.status === 404 && currentType === 'updated') {
              onEvent({ type: 'message-deleted', messageId });
              continue;
            }
            if (response.ok) {
              const payload = (await response.json()) as {
                success?: boolean;
                message?: MessageVM;
              };
              if (payload?.success && payload.message) {
                onEvent({
                  type: currentType === 'added' ? 'message-added' : 'message-updated',
                  message: payload.message,
                });
              } else {
                console.warn(
                  `[Realtime] Invalid message payload for ${messageId}`,
                  payload,
                );
              }
            } else {
              console.error(
                `[Realtime] Failed to fetch message ${messageId}: ${response.status}`,
              );
            }

            const queuedType = queued.get(messageId);
            if (queuedType) {
              queued.delete(messageId);
              nextType = queuedType;
            }
          }
        })();
        pending.set(messageId, task);
        try {
          await task;
        } finally {
          pending.delete(messageId);
        }
      };

      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const messageId = (payload.old as { id?: string } | null)?.id;
            if (messageId) {
              onEvent({ type: 'message-deleted', messageId });
            }
            return;
          }
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as {
              id?: string;
              deleted_at?: string | null;
            } | null;
            if (updated?.id && updated.deleted_at) {
              onEvent({ type: 'message-deleted', messageId: updated.id });
              return;
            }
          }
          const messageId =
            (payload.new as { id?: string } | null)?.id ??
            (payload.old as { id?: string } | null)?.id;
          void fetchMessage(
            messageId ?? '',
            payload.eventType === 'INSERT' ? 'added' : 'updated',
          );
        },
      );

      MESSAGE_PAYLOAD_TABLES.forEach((tableName) => {
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: tableName,
            filter: `org_id=eq.${orgId}`,
          },
          (payload) => {
            const messageId =
              (payload.new as { message_id?: string } | null)?.message_id ??
              (payload.old as { message_id?: string } | null)?.message_id;
            if (messageId) {
              void fetchMessage(messageId, 'updated');
            }
          },
        );
      });

      THREAD_TABLES.forEach((tableName) => {
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: tableName,
            filter: `org_id=eq.${orgId}`,
          },
          (payload) => {
            const parentMessageId =
              (payload.new as { parent_message_id?: string } | null)?.parent_message_id ??
              (payload.old as { parent_message_id?: string } | null)?.parent_message_id;
            if (parentMessageId) {
              void fetchMessage(parentMessageId, 'updated');
            }
          },
        );
      });

      channel.on('broadcast', { event: 'typing' }, (payload) => {
        const data = payload.payload as
          | { profileId?: string; isTyping?: boolean }
          | undefined;
        if (!data?.profileId) {
          return;
        }
        onEvent({
          type: data.isTyping ? 'typing-start' : 'typing-stop',
          profileId: data.profileId,
        });
      });

      channel.on('broadcast', { event: 'message-deleted' }, (payload) => {
        const data = payload.payload as { messageId?: string } | undefined;
        if (!data?.messageId) {
          return;
        }
        onEvent({
          type: 'message-deleted',
          messageId: data.messageId,
        });
      });

      channel.on('broadcast', { event: 'message-updated' }, (payload) => {
        const data = payload.payload as { messageId?: string } | undefined;
        if (!data?.messageId) {
          return;
        }
        void fetchMessage(data.messageId, 'updated');
      });

      let retryCount = 0;
      const maxRetries = 3;

      const attemptSubscribe = () => {
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            retryCount = 0; // Reset on success
          } else if (status === 'CHANNEL_ERROR') {
            console.error(
              `[Realtime] Failed to subscribe to messages:${channelId}`,
              status,
            );
            if (retryCount < maxRetries) {
              retryCount++;

              setTimeout(() => {
                void channel.unsubscribe();
                attemptSubscribe();
              }, 1000 * retryCount); // Exponential backoff
            } else {
              console.error(`[Realtime] Max retries reached for messages:${channelId}`);
            }
          } else if (status === 'TIMED_OUT') {
            console.error(`[Realtime] Subscription timed out for messages:${channelId}`);
            if (retryCount < maxRetries) {
              retryCount++;

              setTimeout(() => {
                void channel.unsubscribe();
                attemptSubscribe();
              }, 1000 * retryCount);
            }
          }
        });
      };

      attemptSubscribe();

      return {
        unsubscribe: () => {
          void channel.unsubscribe();
          if (channelsById.get(channelId) === channel) {
            channelsById.delete(channelId);
          }
        },
      };
    },
    sendTyping: async ({ channelId, profileId, isTyping }) => {
      const channel = channelsById.get(channelId);
      if (!channel) return;
      await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { profileId, isTyping },
      });
    },
    broadcastMessageDeleted: async ({ channelId, messageId }) => {
      const channel = channelsById.get(channelId);
      if (!channel) return;
      await channel.send({
        type: 'broadcast',
        event: 'message-deleted',
        payload: { messageId },
      });
    },
    broadcastMessageUpdated: async ({ channelId, messageId }) => {
      const channel = channelsById.get(channelId);
      if (!channel) return;
      await channel.send({
        type: 'broadcast',
        event: 'message-updated',
        payload: { messageId },
      });
    },
  };
}
