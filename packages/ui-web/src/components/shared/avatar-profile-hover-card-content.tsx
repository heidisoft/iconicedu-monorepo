'use client';

import type * as React from 'react';
import { Clock3, MapPin, MessageCircle } from 'lucide-react';

import { Button } from '@iconicedu/ui-web/ui/button';
import { HoverCardContent } from '@iconicedu/ui-web/ui/hover-card';
import { Separator } from '@iconicedu/ui-web/ui/separator';
import { cn } from '@iconicedu/ui-web/lib/utils';

type AvatarProfileHoverCardContentProps = {
  avatarNode: React.ReactNode;
  canMessage: boolean;
  email?: string | null;
  localTimeLabel?: string | null;
  locationLabel?: string | null;
  messageHref?: string | null;
  onMessageClick?: (() => void) | null;
  previewAbout?: string | null;
  roleLabel?: string | null;
  safeName: string;
  statusEmoji?: string | null;
  lastSeenLabel?: string | null;
  themeClass?: string;
  previewHeaderStyle?: React.CSSProperties;
};

export function AvatarProfileHoverCardContent({
  avatarNode,
  canMessage,
  email,
  localTimeLabel,
  locationLabel,
  messageHref,
  onMessageClick,
  previewAbout,
  roleLabel,
  safeName,
  statusEmoji,
  lastSeenLabel,
  themeClass,
  previewHeaderStyle,
}: AvatarProfileHoverCardContentProps) {
  const dmButton = canMessage ? (
    messageHref ? (
      <Button
        asChild
        variant="secondary"
        size="icon"
        className="h-9 w-9 rounded-full border border-border/60 bg-background shadow-sm hover:bg-accent"
      >
        <a href={messageHref} aria-label="Send direct message">
          <MessageCircle className="h-4.5 w-4.5 text-foreground/75" />
        </a>
      </Button>
    ) : (
      <Button
        variant="secondary"
        size="icon"
        className="h-9 w-9 rounded-full border border-border/60 bg-background shadow-sm hover:bg-accent"
        aria-label="Send direct message"
        onClick={onMessageClick ?? undefined}
      >
        <MessageCircle className="h-4.5 w-4.5 text-foreground/75" />
      </Button>
    )
  ) : null;

  return (
    <HoverCardContent className="w-[22rem] overflow-hidden rounded-[1.6rem] border-0 bg-background p-0 shadow-[0_18px_45px_-20px_rgba(15,23,42,0.32)] sm:w-[26rem]">
      <div
        className={cn(
          'relative h-[5.5rem] overflow-visible rounded-t-[1.6rem] bg-muted',
          themeClass,
        )}
        data-testid="avatar-preview-header"
        style={previewHeaderStyle}
      >
        <div
          className="absolute -bottom-12 left-5 z-20"
          data-testid="avatar-preview-avatar-anchor"
        >
          {avatarNode}
        </div>
        {dmButton ? (
          <div className="absolute -bottom-4 right-5 z-20">{dmButton}</div>
        ) : null}
      </div>

      <div className="bg-background px-5 pb-5 pt-16">
        <div className="mb-5 min-w-0 space-y-1.5">
          <p className="text-xl font-semibold leading-tight text-foreground">
            {safeName}
          </p>
          {roleLabel ? (
            <p className="text-sm font-semibold leading-none text-foreground/80">
              {roleLabel}
            </p>
          ) : null}
          {email ? (
            <p className="truncate pt-1 text-sm leading-none text-muted-foreground">
              {email}
            </p>
          ) : null}
        </div>

        <div className="mb-5 flex flex-col gap-2.5 text-sm text-foreground/80">
          {locationLabel ? (
            <div className="flex items-start gap-2 text-sm text-foreground/70">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-foreground/60" />
              <span>{locationLabel}</span>
            </div>
          ) : null}
          {localTimeLabel ? (
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 shrink-0 text-foreground/60" />
              <span>Local time {localTimeLabel}</span>
            </div>
          ) : null}
        </div>

        {previewAbout ? (
          <p className="mb-5 text-sm leading-relaxed text-foreground/70">
            {statusEmoji ? `${statusEmoji} ` : ''}
            {previewAbout}
          </p>
        ) : null}

        <Separator className="mb-4" />

        <div className="flex items-center justify-between gap-3">
          {lastSeenLabel ? (
            <p className="text-xs text-foreground/50">{lastSeenLabel}</p>
          ) : (
            <div />
          )}
          <div />
        </div>
      </div>
    </HoverCardContent>
  );
}
