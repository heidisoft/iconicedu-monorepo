import { useState, useCallback } from 'react';
import type { MessageVM } from '@iconicedu/shared-types';
import {
  prependUniqueMessages,
  removeMessageById,
  updateMessageById,
  upsertMessage,
} from '@iconicedu/ui-web/components/messages/message-list.utils';

export function useMessages(initialMessages: MessageVM[]) {
  const [messages, setMessages] = useState<MessageVM[]>(() =>
    prependUniqueMessages([], initialMessages),
  );

  const addMessage = useCallback((message: MessageVM) => {
    setMessages((prev) => upsertMessage(prev, message));
  }, []);

  const prependMessages = useCallback((olderMessages: MessageVM[]) => {
    setMessages((prev) => prependUniqueMessages(prev, olderMessages));
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<MessageVM>) => {
    setMessages((prev) => updateMessageById(prev, id, updates));
  }, []);

  const deleteMessage = useCallback((id: string) => {
    setMessages((prev) => removeMessageById(prev, id));
  }, []);

  const toggleReaction = useCallback(
    (messageId: string, emoji: string, userId: string) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.ids.id !== messageId) return msg;

          const reactions = [...msg.social.reactions];
          const existingReactionIndex = reactions.findIndex((r) => r.emoji === emoji);

          if (existingReactionIndex >= 0) {
            const reaction = reactions[existingReactionIndex];
            const sampleUserIds = reaction.sampleUserIds ?? [];
            const hasReacted = reaction.reactedByMe ?? false;

            if (hasReacted) {
              const nextCount = Math.max(0, reaction.count - 1);
              const updatedSampleUserIds = sampleUserIds.filter((id) => id !== userId);
              if (nextCount === 0) {
                reactions.splice(existingReactionIndex, 1);
              } else {
                reactions[existingReactionIndex] = {
                  ...reaction,
                  count: nextCount,
                  reactedByMe: false,
                  sampleUserIds: updatedSampleUserIds,
                };
              }
            } else {
              const updatedSampleUserIds = sampleUserIds.includes(userId)
                ? sampleUserIds
                : [userId, ...sampleUserIds].slice(0, 3);
              reactions[existingReactionIndex] = {
                ...reaction,
                count: reaction.count + 1,
                reactedByMe: true,
                sampleUserIds: updatedSampleUserIds,
              };
            }
          } else {
            // Create new reaction
            reactions.push({
              emoji,
              count: 1,
              reactedByMe: true,
              sampleUserIds: [userId],
            });
          }

          return {
            ...msg,
            social: {
              ...msg.social,
              reactions,
            },
          };
        }),
      );
    },
    [],
  );

  const toggleSaved = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.ids.id === messageId
          ? {
              ...msg,
              state: {
                ...msg.state,
                isSaved: !msg.state?.isSaved,
              },
            }
          : msg,
      ),
    );
  }, []);

  const toggleHidden = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.ids.id === messageId
          ? {
              ...msg,
              state: {
                ...msg.state,
                isHidden: !msg.state?.isHidden,
              },
            }
          : msg,
      ),
    );
  }, []);

  return {
    messages,
    addMessage,
    prependMessages,
    updateMessage,
    deleteMessage,
    toggleReaction,
    toggleSaved,
    toggleHidden,
  };
}
