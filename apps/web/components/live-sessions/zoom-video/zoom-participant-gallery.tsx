'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { RefObject } from 'react';

import { Button } from '@iconicedu/ui-web/ui/button';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { ZoomVideoTile } from './zoom-video-tile';
import type { RemoteParticipant } from './zoom-video-session.types';

export function ZoomParticipantGallery({
  displayName,
  selfAvatar,
  selfMuted,
  selfVideoOn,
  selfHandRaised,
  selfVideoRef,
  remoteParticipants,
  raisedHandUserIds,
  activeSpeakerUserId,
  selfUserId,
  onRemoteContainer,
  sidebarOpen,
  page,
  onPageChange,
}: {
  displayName: string;
  selfAvatar?: string;
  selfMuted: boolean;
  selfVideoOn: boolean;
  selfHandRaised: boolean;
  selfVideoRef: RefObject<HTMLDivElement | null>;
  remoteParticipants: RemoteParticipant[];
  raisedHandUserIds: Set<number>;
  activeSpeakerUserId: number | null;
  selfUserId: number | null;
  onRemoteContainer: (userId: number, element: HTMLDivElement | null) => void;
  sidebarOpen: boolean;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const count = remoteParticipants.length + 1;
  const pageSize = 4;
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * pageSize;
  const visibleRemoteParticipants = remoteParticipants.filter((_, index) => {
    const position = index + 1;
    return position >= pageStart && position < pageStart + pageSize;
  });
  const showSelf = pageStart === 0;
  const visibleCount = visibleRemoteParticipants.length + (showSelf ? 1 : 0);

  return (
    <>
      <div
        className={cn(
          'zoom-meeting-gutter-padding zoom-participant-gallery absolute inset-x-0 grid place-items-center animate-in gap-3 overflow-y-auto fade-in-0 duration-300 motion-reduce:animate-none',
          visibleCount === 1 && 'grid-cols-1',
          visibleCount === 2 && 'grid-cols-1 sm:grid-cols-2',
          visibleCount >= 3 && 'grid-cols-2',
          sidebarOpen && 'zoom-gallery-sidebar',
        )}
      >
        {showSelf ? (
          <ZoomVideoTile
            label={displayName}
            avatarUrl={selfAvatar}
            isSelf
            isMuted={selfMuted}
            isVideoOn={selfVideoOn}
            videoContainerRef={selfVideoRef}
            className="aspect-video max-h-full w-full max-w-full"
            handRaised={selfHandRaised}
            handPosition="right"
            isSpeaking={selfUserId !== null && activeSpeakerUserId === selfUserId}
          />
        ) : null}
        {visibleRemoteParticipants.map((participant, index) => (
          <ZoomVideoTile
            key={participant.userId}
            label={participant.displayName}
            avatarUrl={participant.avatar}
            isSelf={false}
            isMuted={participant.muted}
            isVideoOn={participant.bVideoOn}
            videoContainerRef={(element) =>
              onRemoteContainer(participant.userId, element)
            }
            className="aspect-video max-h-full w-full max-w-full"
            handRaised={raisedHandUserIds.has(participant.userId)}
            handPosition={index % 2 === 0 ? 'left' : 'right'}
            isSpeaking={activeSpeakerUserId === participant.userId}
          />
        ))}
      </div>
      {pageCount > 1 ? (
        <nav
          className="absolute inset-x-0 bottom-24 z-20 flex items-center justify-center gap-2 sm:bottom-28 lg:bottom-32"
          aria-label="Gallery pages"
        >
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="rounded-full"
            disabled={safePage === 0}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Previous gallery page"
          >
            <ChevronLeft />
          </Button>
          <span className="rounded-full bg-secondary px-3 py-2 text-xs font-medium tabular-nums text-secondary-foreground">
            {safePage + 1} / {pageCount}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="rounded-full"
            disabled={safePage === pageCount - 1}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Next gallery page"
          >
            <ChevronRight />
          </Button>
        </nav>
      ) : null}
    </>
  );
}
