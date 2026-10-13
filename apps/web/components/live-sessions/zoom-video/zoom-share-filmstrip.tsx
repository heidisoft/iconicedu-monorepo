'use client';

import type { RefObject } from 'react';

import { cn } from '@iconicedu/ui-web/lib/utils';
import type { RemoteParticipant } from './zoom-video-session.types';
import { ZoomVideoTile } from './zoom-video-tile';
import { FullscreenParticipants } from './fullscreen-participants';

export function ZoomShareFilmstrip({
  displayName,
  selfAvatar,
  selfMuted,
  selfVideoOn,
  selfHandRaised,
  selfVideoRef,
  remoteParticipants,
  raisedHandUserIds,
  activeSpeakerUserId,
  speakingUserIds,
  selfUserId,
  sidebarOpen,
  onRemoteContainer,
  onReady,
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
  speakingUserIds?: ReadonlySet<number>;
  selfUserId: number | null;
  sidebarOpen: boolean;
  onReady?: () => void;
  onRemoteContainer: (userId: number, element: HTMLDivElement | null) => void;
}) {
  const featuredId = remoteParticipants.some(
    (participant) => participant.userId === activeSpeakerUserId,
  )
    ? activeSpeakerUserId
    : remoteParticipants[0]?.userId;
  return (
    <FullscreenParticipants onReady={onReady}>
      <div
        className={cn(
          'zoom-filmstrip absolute inset-x-4 bottom-24 z-20 flex animate-in flex-row gap-2 overflow-x-auto overflow-y-hidden fade-in-0 slide-in-from-bottom-2 duration-300 motion-reduce:animate-none sm:inset-x-6 sm:bottom-28 lg:inset-x-auto lg:bottom-32 lg:top-24 lg:w-56 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:slide-in-from-right-2',
          sidebarOpen && 'zoom-filmstrip-panel',
        )}
        aria-label="Meeting participants"
      >
        {remoteParticipants.map((participant) => (
          <ZoomVideoTile
            key={participant.userId}
            label={participant.displayName}
            avatarUrl={participant.avatar}
            isSelf={false}
            fullscreenFeatured={participant.userId === featuredId}
            isMuted={participant.muted}
            isVideoOn={participant.bVideoOn}
            videoContainerRef={(element) =>
              onRemoteContainer(participant.userId, element)
            }
            className="zoom-video-tile-filmstrip aspect-video w-28 sm:w-36 lg:w-full"
            handRaised={raisedHandUserIds.has(participant.userId)}
            density="compact"
            isSpeaking={
              !participant.muted &&
              (speakingUserIds
                ? speakingUserIds.has(participant.userId)
                : activeSpeakerUserId === participant.userId)
            }
          />
        ))}
        <ZoomVideoTile
          label={displayName}
          avatarUrl={selfAvatar}
          isSelf
          isMuted={selfMuted}
          isVideoOn={selfVideoOn}
          videoContainerRef={selfVideoRef}
          className="zoom-video-tile-filmstrip aspect-video w-28 sm:w-36 lg:w-full"
          handRaised={selfHandRaised}
          density="compact"
          isSpeaking={
            !selfMuted &&
            selfUserId !== null &&
            (speakingUserIds
              ? speakingUserIds.has(selfUserId)
              : activeSpeakerUserId === selfUserId)
          }
        />
      </div>
    </FullscreenParticipants>
  );
}
