'use client';
import { useLiveSessionJoinContext } from '../messages/live-session-join-context';

import { useState } from 'react';
import { Loader2, MessageSquare, Video } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { cn } from '@iconicedu/ui-web/lib/utils';
import type { ActivityFeedItemVM } from '@iconicedu/shared-types';
import { ExternalLiveSessionJoinDialog } from '@iconicedu/ui-web/components/messages/external-live-session-join-dialog';
import { useExternalLiveSessionJoinDialog } from '@iconicedu/ui-web/components/messages/use-external-live-session-join-dialog';

export function ActivityWithButton({
  activity,
  className,
}: {
  activity: ActivityFeedItemVM;
  className?: string;
}) {
  const joinContext = useLiveSessionJoinContext();
  const actionButton = activity.content.actionButton;
  const [isJoinPending, setIsJoinPending] = useState(false);
  const { externalJoinTarget, closeExternalJoinDialog, handleResolvedJoinHref } =
    useExternalLiveSessionJoinDialog();

  if (!actionButton) {
    return null;
  }

  const href = actionButton.href ?? undefined;
  const secondaryAction =
    actionButton.payload &&
    typeof actionButton.payload === 'object' &&
    !Array.isArray(actionButton.payload) &&
    typeof actionButton.payload.secondaryAction === 'object' &&
    actionButton.payload.secondaryAction !== null
      ? (actionButton.payload.secondaryAction as {
          href?: string;
          label?: string;
          kind?: string;
        })
      : null;
  const secondaryHref =
    secondaryAction && typeof secondaryAction.href === 'string'
      ? secondaryAction.href
      : undefined;
  const secondaryLabel =
    secondaryAction && typeof secondaryAction.label === 'string'
      ? secondaryAction.label
      : 'Open chat';
  const showSecondaryChatButton =
    secondaryAction?.kind === 'open-chat' && Boolean(secondaryHref);
  const joinChannelId =
    actionButton.payload &&
    typeof actionButton.payload === 'object' &&
    !Array.isArray(actionButton.payload) &&
    typeof actionButton.payload.channelId === 'string'
      ? actionButton.payload.channelId
      : null;
  const isLiveSessionJoinAction =
    actionButton.actionKey === 'live-session.join' && Boolean(joinChannelId);
  const isOpenClassroomChatAction = actionButton.label === 'Open classroom chat';

  const handleJoinAction = async () => {
    if (!joinChannelId || isJoinPending) {
      return;
    }
    if (!joinContext) throw new Error('Meeting join context is required');

    setIsJoinPending(true);
    try {
      const payload = await joinContext.joinChannel(joinChannelId);
      handleResolvedJoinHref(payload.joinPath, payload.provider, payload.passcode);
    } finally {
      setIsJoinPending(false);
    }
  };

  return (
    <>
      <div className={cn('flex items-center gap-2', className)}>
        {isLiveSessionJoinAction ? (
          <Button
            size="sm"
            variant={actionButton.variant}
            data-action-button="true"
            className="h-7 text-xs"
            disabled={isJoinPending}
            onClick={(event) => {
              event.stopPropagation();
              void handleJoinAction();
            }}
          >
            {isJoinPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Video className="h-4 w-4" />
            )}
            {actionButton.label}
          </Button>
        ) : (
          <Button
            size="sm"
            variant={actionButton.variant}
            data-action-button="true"
            className="h-7 text-xs"
            disabled={!href}
            asChild={Boolean(href)}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {href ? (
              <a href={href} className="inline-flex items-center gap-1.5">
                {isOpenClassroomChatAction ? (
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                ) : null}
                <span>{actionButton.label}</span>
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                {isOpenClassroomChatAction ? (
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                ) : null}
                <span>{actionButton.label}</span>
              </span>
            )}
          </Button>
        )}
        {showSecondaryChatButton ? (
          <Button
            size="icon"
            variant="outline"
            data-action-button="true"
            className="h-7 w-7"
            asChild
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <a href={secondaryHref} aria-label={secondaryLabel} title={secondaryLabel}>
              <MessageSquare className="h-3.5 w-3.5" />
            </a>
          </Button>
        ) : null}
      </div>
      <ExternalLiveSessionJoinDialog
        target={externalJoinTarget}
        onOpenChange={(open) => {
          if (!open) {
            closeExternalJoinDialog();
          }
        }}
      />
    </>
  );
}
