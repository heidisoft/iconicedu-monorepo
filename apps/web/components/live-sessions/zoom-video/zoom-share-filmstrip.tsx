'use client';

import type { RefObject } from 'react';

import { cn } from '@iconicedu/ui-web/lib/utils';
import type { RemoteParticipant } from './zoom-video-session.types';
import { ZoomVideoTile } from './zoom-video-tile';

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
  selfUserId,
  sidebarOpen,
  onRemoteContainer,
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
  sidebarOpen: boolean;
  onRemoteContainer: (userId: number, element: HTMLDivElement | null) => void;
}) {
  return (
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
          isMuted={participant.muted}
          isVideoOn={participant.bVideoOn}
          videoContainerRef={(element) => onRemoteContainer(participant.userId, element)}
          className="zoom-video-tile-filmstrip aspect-video w-28 sm:w-36 lg:w-full"
          handRaised={raisedHandUserIds.has(participant.userId)}
          density="compact"
          isSpeaking={activeSpeakerUserId === participant.userId}
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
        isSpeaking={selfUserId !== null && activeSpeakerUserId === selfUserId}
      />
    </div>
  );
}
