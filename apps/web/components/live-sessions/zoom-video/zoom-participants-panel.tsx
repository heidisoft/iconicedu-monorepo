'use client';

import { AudioLines, EllipsisVertical, Hand, MicOff, Users } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@iconicedu/ui-web/ui/avatar';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { IconActionButton } from '@iconicedu/ui-web/ui/icon-action-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@iconicedu/ui-web/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@iconicedu/ui-web/ui/sheet';
import { getInitials } from '@iconicedu/ui-web/lib/utils';
import { MediaStateIndicator } from './zoom-meeting-controls';
import { ZoomMeetingDockButton } from './zoom-meeting-side-dock';

export type ParticipantListItem = {
  userId: number;
  name: string;
  avatarUrl?: string;
  isYou: boolean;
  isHost: boolean;
  muted: boolean;
  videoOn: boolean;
  handRaised: boolean;
  reaction?: string;
  isSpeaking: boolean;
};

export function ZoomParticipantsPanel({
  open,
  participants,
  canMuteOthers,
  className,
  onOpenChange,
  onMute,
}: {
  open: boolean;
  participants: ParticipantListItem[];
  canMuteOthers: boolean;
  className?: string;
  onOpenChange: (open: boolean) => void;
  onMute: (userId: number, displayName: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <ZoomMeetingDockButton
          label="Participants"
          count={participants.length}
          active={open}
          compact
          className={className}
        >
          <Users className="size-4" />
        </ZoomMeetingDockButton>
      </SheetTrigger>
      <SheetContent
        side="right"
        dismissible
        overlayClassName="md:pointer-events-none md:bg-transparent"
        className="zoom-meeting-panel w-[calc(100vw-1rem)] gap-0 overflow-visible rounded-l-3xl p-0 sm:max-w-[32rem] [&>[data-slot=sheet-close]]:right-7 [&>[data-slot=sheet-close]]:top-7 md:rounded-[2rem] md:border md:data-[state=closed]:slide-out-to-bottom-4 md:data-[state=open]:slide-in-from-bottom-4 md:after:absolute md:after:-bottom-3 md:after:right-16 md:after:size-6 md:after:rotate-45 md:after:border-r md:after:border-b md:after:border-border md:after:bg-background lg:rounded-[2.5rem] motion-reduce:transition-none motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none"
      >
        <SheetHeader className="px-8 pb-4 pt-8">
          <SheetTitle className="text-3xl font-medium tracking-tight">People</SheetTitle>
        </SheetHeader>
        <div className="mx-8 mb-5 flex h-14 items-center rounded-full bg-muted p-1">
          <div className="flex h-full flex-1 items-center justify-center gap-3 rounded-full bg-foreground px-5 text-sm font-medium text-background">
            <span>In meeting</span>
            <Badge className="rounded-full bg-background/15 px-2 text-background">
              {participants.length}
            </Badge>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-6 pb-8">
          {participants.map((participant) => (
            <div
              key={participant.userId}
              className="flex min-h-14 items-center gap-2 rounded-2xl px-3 py-1.5 hover:bg-accent"
            >
              <Avatar className="size-10">
                {participant.avatarUrl ? (
                  <AvatarImage src={participant.avatarUrl} alt="" />
                ) : null}
                <AvatarFallback>{getInitials(participant.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {participant.name}
                  {participant.isYou ? ' (You)' : ''}
                </p>
                {participant.isHost ? (
                  <p className="text-xs text-muted-foreground">Meeting host</p>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5">
                {participant.reaction ? (
                  <span
                    className="inline-flex size-8 items-center justify-center text-2xl"
                    role="img"
                    aria-label={`${participant.name} reacted ${participant.reaction}`}
                  >
                    {participant.reaction}
                  </span>
                ) : null}
                {participant.handRaised ? (
                  <span
                    className="inline-flex size-8 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-sm"
                    aria-label={`${participant.name} raised their hand`}
                    title="Hand raised"
                  >
                    <Hand className="size-4" strokeWidth={2.5} aria-hidden="true" />
                  </span>
                ) : null}
                {participant.isSpeaking ? (
                  <span
                    className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    aria-label={`${participant.name} is speaking`}
                  >
                    <AudioLines className="size-4" aria-hidden="true" />
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5">
                <MediaStateIndicator kind="microphone" enabled={!participant.muted} />
                <MediaStateIndicator kind="camera" enabled={participant.videoOn} />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconActionButton
                    variant="secondary"
                    size="icon"
                    className="rounded-full"
                    label={`Options for ${participant.name}`}
                  >
                    <EllipsisVertical />
                  </IconActionButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {canMuteOthers && !participant.isYou && !participant.muted ? (
                    <DropdownMenuItem
                      onSelect={() => onMute(participant.userId, participant.name)}
                    >
                      <MicOff />
                      Mute participant
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
