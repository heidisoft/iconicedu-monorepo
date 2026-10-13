'use client';
import { useEffect, useRef, useState } from 'react';
import type { LiveSessionSettingsVM } from '@iconicedu/shared-types';
import type { ZoomClient } from '@iconicedu/web/lib/live-sessions/zoom-session-lifecycle';
import type { ChatMessageItem } from './zoom-video-session.types';

/** In-call messages own subscriptions, unread state, drafts and sending policy. */
export function useZoomMessagesFeature(
  client: ZoomClient | null,
  policy: LiveSessionSettingsVM['messages'],
  open: boolean,
  displayName: string,
) {
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [draft, setDraft] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const pending = useRef(false);
  useEffect(() => {
    if (open) setUnreadCount(0);
  }, [open]);
  useEffect(() => {
    if (!client || !policy.visible) return;
    const receive = (payload: {
      id?: string;
      message?: string;
      sender: { userId: number; name: string };
      timestamp: number;
    }) => {
      if (!payload.message) return;
      setMessages((previous) => [
        ...previous,
        {
          id: payload.id ?? `${payload.sender.userId}-${payload.timestamp}`,
          senderUserId: payload.sender.userId,
          senderName: payload.sender.name,
          message: payload.message!,
          timestamp: payload.timestamp,
        },
      ]);
      if (!openRef.current) setUnreadCount((count) => count + 1);
    };
    client.on('chat-on-message', receive);
    return () => client.off('chat-on-message', receive);
  }, [client, policy.visible]);
  async function send() {
    const text = draft.trim();
    if (!client || !policy.visible || !policy.enabled || !text || pending.current) return;
    pending.current = true;
    setError(null);
    try {
      const result = await client.getChatClient().sendToAll(text);
      if (result instanceof Error) throw result;
      setDraft('');
      setMessages((previous) => [
        ...previous,
        {
          id: result.id ?? `self-${result.timestamp}`,
          senderUserId: client.getCurrentUserInfo().userId,
          senderName: displayName,
          message: text,
          timestamp: result.timestamp,
        },
      ]);
    } catch {
      setError('Message could not be sent. Try again.');
    } finally {
      pending.current = false;
    }
  }
  return { messages, draft, setDraft, unreadCount, send, error };
}
