'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { RefObject } from 'react';

import { IconActionButton } from '@iconicedu/ui-web/ui/icon-action-button';
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
          visibleCount === 1 && 'grid-cols-1 grid-rows-1',
          visibleCount === 2 && 'grid-cols-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1',
          visibleCount >= 3 && 'grid-cols-2 grid-rows-2',
          sidebarOpen && 'zoom-gallery-sidebar',
        )}
      >
        {showSelf ? (
          <div className="zoom-gallery-cell">
            <ZoomVideoTile
              label={displayName}
              avatarUrl={selfAvatar}
              isSelf
              isMuted={selfMuted}
              isVideoOn={selfVideoOn}
              videoContainerRef={selfVideoRef}
              className="zoom-gallery-tile aspect-video"
              handRaised={selfHandRaised}
              handPosition="right"
              isSpeaking={selfUserId !== null && activeSpeakerUserId === selfUserId}
            />
          </div>
        ) : null}
        {visibleRemoteParticipants.map((participant, index) => (
          <div key={participant.userId} className="zoom-gallery-cell">
            <ZoomVideoTile
              label={participant.displayName}
              avatarUrl={participant.avatar}
              isSelf={false}
              isMuted={participant.muted}
              isVideoOn={participant.bVideoOn}
              videoContainerRef={(element) =>
                onRemoteContainer(participant.userId, element)
              }
              className="zoom-gallery-tile aspect-video"
              handRaised={raisedHandUserIds.has(participant.userId)}
              handPosition={index % 2 === 0 ? 'left' : 'right'}
              isSpeaking={activeSpeakerUserId === participant.userId}
            />
          </div>
        ))}
      </div>
      {pageCount > 1 ? (
        <nav
          className="absolute inset-x-0 bottom-24 z-20 flex items-center justify-center gap-2 sm:bottom-28 lg:bottom-32"
          aria-label="Gallery pages"
        >
          <IconActionButton
            variant="secondary"
            size="icon"
            className="rounded-full"
            disabled={safePage === 0}
            onClick={() => onPageChange(safePage - 1)}
            label="Previous gallery page"
          >
            <ChevronLeft />
          </IconActionButton>
          <span className="rounded-full bg-secondary px-3 py-2 text-xs font-medium tabular-nums text-secondary-foreground">
            {safePage + 1} / {pageCount}
          </span>
          <IconActionButton
            variant="secondary"
            size="icon"
            className="rounded-full"
            disabled={safePage === pageCount - 1}
            onClick={() => onPageChange(safePage + 1)}
            label="Next gallery page"
          >
            <ChevronRight />
          </IconActionButton>
        </nav>
      ) : null}
    </>
  );
}
