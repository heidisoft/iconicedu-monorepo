'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  Eye,
  Sparkles,
  Tag,
  Shield,
  CircleDot,
  BellOff,
} from 'lucide-react';
import type {
  MessagesRightPanelIntent,
  NotificationConversationMode,
} from '@iconicedu/shared-types';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Separator } from '@iconicedu/ui-web/ui/separator';
import { getChannelTopicIcon } from '@iconicedu/ui-web/lib/icons';
import { ThemedIconBadge } from '@iconicedu/ui-web/components/shared/themed-icon';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { useMessagesState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';

interface ChannelInfoPanelProps {
  intent: MessagesRightPanelIntent;
}

const MUTE_DURATION_OPTIONS: Array<{ key: string; label: string; ms: number }> = [
  { key: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
  { key: '8h', label: '8 hours', ms: 8 * 60 * 60 * 1000 },
  { key: '24h', label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { key: '1w', label: '1 week', ms: 7 * 24 * 60 * 60 * 1000 },
];

function formatMutedUntilLabel(mutedUntil: string | null): string | null {
  if (!mutedUntil) return null;
  const date = new Date(mutedUntil);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type ConversationModeResponse = {
  success?: boolean;
  data?: { mode?: NotificationConversationMode; mutedUntil?: string | null };
};

/**
 * Per-conversation notification controls: normal / mentions-only / mute for a duration /
 * mute until turned back on. Scoped to the given channel via the notification-preferences
 * conversation-mode proxy routes.
 */
export function NotificationConversationSection({ channelId }: { channelId: string }) {
  const [mode, setMode] = useState<NotificationConversationMode>('normal');
  const [mutedUntil, setMutedUntil] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadMode = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ scopeKind: 'channel', scopeId: channelId });
        const response = await fetch(
          `/api/notification-preferences/conversation-mode?${params.toString()}`,
        );
        const payload = (await response
          .json()
          .catch(() => null)) as ConversationModeResponse | null;
        if (!cancelled && response.ok && payload?.success && payload.data) {
          setMode(payload.data.mode ?? 'normal');
          setMutedUntil(payload.data.mutedUntil ?? null);
        }
      } catch {
        // Best effort — default to "normal" when the mode can't be loaded.
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void loadMode();
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  const saveMode = useCallback(
    (
      actionKey: string,
      nextMode: NotificationConversationMode,
      nextMutedUntil: string | null,
    ) => {
      const previousMode = mode;
      const previousMutedUntil = mutedUntil;
      setMode(nextMode);
      setMutedUntil(nextMutedUntil);
      setPendingAction(actionKey);
      const persist = async () => {
        try {
          const response = await fetch(
            '/api/notification-preferences/conversation-mode',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                scopeKind: 'channel',
                scopeId: channelId,
                mode: nextMode,
                mutedUntil: nextMutedUntil,
              }),
            },
          );
          const payload = (await response.json().catch(() => null)) as {
            success?: boolean;
          } | null;
          if (!response.ok || !payload?.success) {
            throw new Error('Unable to save notification mode');
          }
        } catch {
          setMode(previousMode);
          setMutedUntil(previousMutedUntil);
        } finally {
          setPendingAction(null);
        }
      };
      void persist();
    },
    [channelId, mode, mutedUntil],
  );

  const isMuted = mode === 'muted_until' || mode === 'muted_until_enabled';
  const mutedUntilLabel =
    mode === 'muted_until' ? formatMutedUntilLabel(mutedUntil) : null;

  const optionButtonClass = (isActive: boolean) =>
    cn(
      'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
      isActive
        ? 'border-primary/60 bg-primary/5 text-foreground'
        : 'border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground',
    );

  return (
    <div className="space-y-4 p-4 min-w-0">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
        {isMuted ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <BellOff className="h-3.5 w-3.5" />
            {mode === 'muted_until_enabled'
              ? 'Muted'
              : mutedUntilLabel
                ? `Muted until ${mutedUntilLabel}`
                : 'Muted'}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading notification settings…</p>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            className={optionButtonClass(mode === 'normal')}
            disabled={pendingAction !== null}
            onClick={() => saveMode('normal', 'normal', null)}
          >
            Normal
          </button>
          <button
            type="button"
            className={optionButtonClass(mode === 'mentions_only')}
            disabled={pendingAction !== null}
            onClick={() => saveMode('mentions_only', 'mentions_only', null)}
          >
            Mentions only
          </button>
          <button
            type="button"
            className={optionButtonClass(mode === 'muted_until_enabled')}
            disabled={pendingAction !== null}
            onClick={() => saveMode('muted_until_enabled', 'muted_until_enabled', null)}
          >
            Mute until I turn it back on
          </button>
          <div className="rounded-lg border border-border p-2">
            <div
              className={cn(
                'mb-2 px-1 text-xs font-medium',
                mode === 'muted_until' ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              Mute for…
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {MUTE_DURATION_OPTIONS.map((option) => (
                <Button
                  key={option.key}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pendingAction !== null}
                  className="h-8 text-xs"
                  onClick={() =>
                    saveMode(
                      option.key,
                      'muted_until',
                      new Date(Date.now() + option.ms).toISOString(),
                    )
                  }
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {isMuted ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full"
              disabled={pendingAction !== null}
              onClick={() => saveMode('normal', 'normal', null)}
            >
              Turn on notifications
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

const ChannelInfoPanelContent = memo(function ChannelInfoPanelContent() {
  const { channel, enableNotificationConversationControls } = useMessagesState();
  const iconKey = channel.basics.iconKey ?? 'sparkles';
  const TopicIcon = getChannelTopicIcon(iconKey, Sparkles);
  const metadata = getChannelMetadata(channel);
  return (
    <div className="flex-1 min-w-0">
      <div className="flex flex-col items-center gap-3 p-6 min-w-0">
        <ThemedIconBadge
          icon={TopicIcon}
          themeKey={channel.ui?.themeKey ?? null}
          size="lg"
        />
        <div className="text-center min-w-0">
          <h2 className="text-lg font-semibold text-foreground break-words">
            {channel.basics.topic}
          </h2>
          {channel.basics.description ? (
            <p className="mt-1 text-sm text-muted-foreground break-words">
              {channel.basics.description}
            </p>
          ) : null}
        </div>
        {channel.basics.purpose ? (
          <Badge variant="secondary" className="text-xs">
            {channel.basics.purpose.replace('-', ' ')}
          </Badge>
        ) : null}
      </div>

      <div className="space-y-4 p-4 min-w-0">
        <h3 className="text-sm font-semibold text-foreground">Details</h3>
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          {metadata.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
                <span className="max-w-[60%] truncate text-right text-foreground">
                  {item.value}
                </span>
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Tag className="h-4 w-4" />
              Channel ID
            </span>
            <span className="max-w-[60%] truncate text-right text-foreground">
              {channel.ids.id}
            </span>
          </div>
        </div>
      </div>
      <Separator />
      {enableNotificationConversationControls ? (
        <>
          <NotificationConversationSection channelId={channel.ids.id} />
          <Separator />
        </>
      ) : null}
    </div>
  );
});

export function getChannelMetadata(
  channel: ReturnType<typeof useMessagesState>['channel'],
) {
  const createdAt = channel.lifecycle?.createdAt
    ? new Date(channel.lifecycle.createdAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Unknown';

  return [
    { label: 'Created', value: createdAt, icon: CalendarDays },
    {
      label: 'Visibility',
      value: channel.basics.visibility,
      icon: Eye,
    },
    {
      label: 'Purpose',
      value: channel.basics.purpose,
      icon: Tag,
    },
    {
      label: 'Posting',
      value: channel.postingPolicy.kind,
      icon: Shield,
    },
    {
      label: 'Status',
      value: channel.lifecycle.status,
      icon: CircleDot,
    },
  ];
}

export function ChannelInfoPanel(_: ChannelInfoPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <ChannelInfoPanelContent />
    </div>
  );
}
