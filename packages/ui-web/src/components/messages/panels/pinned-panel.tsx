'use client';

import { useEffect, useMemo, useState, memo, useCallback } from 'react';
import { toast } from 'sonner';
import { Pin, PinOff, Loader2 } from 'lucide-react';
import type { MessagesRightPanelIntent, PinnedMessageVM } from '@iconicedu/shared-types';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  AvatarWithStatus,
  getAvatarRoleLabel,
} from '@iconicedu/ui-web/components/shared/avatar-with-status';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';
import { isTextMessage } from '@iconicedu/ui-web/lib/message-guards';
import { formatDistanceToNow } from 'date-fns';
import { useMessagesState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';

interface PinnedPanelProps {
  intent: MessagesRightPanelIntent;
}

function getPinnedMessagePreview(pin: PinnedMessageVM): string {
  if (isTextMessage(pin.message)) {
    return pin.message.content.text;
  }
  return `${pin.message.core.type.replace(/-/g, ' ')} message`;
}

const EmptyState = memo(function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Pin className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mb-1 text-sm font-semibold text-foreground">No pinned messages</h3>
        <p className="text-xs text-muted-foreground">
          Important messages pinned by staff and educators will appear here.
        </p>
      </div>
    </div>
  );
});

export function PinnedPanel(_: PinnedPanelProps) {
  const { channel, scrollToMessage, close, messages } = useMessagesState();
  const [pins, setPins] = useState<PinnedMessageVM[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unpinningIds, setUnpinningIds] = useState<Record<string, true>>({});

  const loadPins = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ channelId: channel.ids.id });
      const response = await window.fetch(`/api/messages/pins?${params.toString()}`);
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        data?: PinnedMessageVM[];
        message?: string;
      } | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message ?? 'Unable to load pinned messages');
      }
      setPins(payload.data ?? []);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Unable to load pinned messages',
      );
    } finally {
      setIsLoading(false);
    }
  }, [channel.ids.id]);

  useEffect(() => {
    void loadPins();
  }, [loadPins]);

  const handleUnpin = useCallback(
    async (messageId: string) => {
      setUnpinningIds((current) => ({ ...current, [messageId]: true }));
      const previous = pins;
      setPins((current) =>
        (current ?? []).filter((pin) => pin.message.ids.id !== messageId),
      );
      try {
        const response = await window.fetch('/api/messages/pins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelId: channel.ids.id,
            messageId,
            isPinned: false,
          }),
        });
        const payload = (await response.json().catch(() => null)) as {
          success?: boolean;
          message?: string;
        } | null;
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message ?? 'Unable to unpin message');
        }
      } catch (error) {
        setPins(previous ?? null);
        toast.error(error instanceof Error ? error.message : 'Unable to unpin message');
      } finally {
        setUnpinningIds((current) => {
          const next = { ...current };
          delete next[messageId];
          return next;
        });
      }
    },
    [channel.ids.id, pins],
  );

  const handleMessageClick = useCallback(
    (messageId: string) => {
      const isLoaded = messages.some((message) => message.ids.id === messageId);
      close();
      if (isLoaded) {
        scrollToMessage?.(messageId);
      } else {
        toast.info('Scroll up to load older messages, then try again.');
      }
    },
    [close, messages, scrollToMessage],
  );

  const sortedPins = useMemo(
    () =>
      [...(pins ?? [])].sort(
        (a, b) => new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime(),
      ),
    [pins],
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading pinned messages...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {loadError}
      </div>
    );
  }

  if (sortedPins.length === 0) {
    return <EmptyState />;
  }

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-2 p-4">
        {sortedPins.map((pin) => {
          const messageId = pin.message.ids.id;
          const senderName = getProfileDisplayName(pin.message.core.sender.profile);
          const pinnerName = getProfileDisplayName(pin.pinnedBy.profile);
          const preview = getPinnedMessagePreview(pin);
          const truncatedPreview =
            preview.length > 140 ? `${preview.slice(0, 140)}...` : preview;
          const isUnpinning = Boolean(unpinningIds[messageId]);

          return (
            <div
              key={messageId}
              className="flex gap-3 rounded-xl border border-border bg-card p-3"
            >
              <button
                type="button"
                onClick={() => handleMessageClick(messageId)}
                className="flex min-w-0 flex-1 gap-3 text-left"
              >
                <AvatarWithStatus
                  accountId={pin.message.core.sender.ids.accountId}
                  profileId={pin.message.core.sender.ids.id}
                  name={senderName}
                  avatar={pin.message.core.sender.profile.avatar}
                  roleLabel={getAvatarRoleLabel(pin.message.core.sender.kind)}
                  sizeClassName="h-10 w-10 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {senderName}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(pin.message.core.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {truncatedPreview}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pinned by {pinnerName}{' '}
                    {formatDistanceToNow(new Date(pin.pinnedAt), { addSuffix: true })}
                  </p>
                </div>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label="Unpin message"
                disabled={isUnpinning}
                onClick={() => void handleUnpin(messageId)}
              >
                {isUnpinning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PinOff className="h-4 w-4" />
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
