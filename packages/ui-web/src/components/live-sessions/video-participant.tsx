'use client';

import type { ReactNode } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VideoParticipantProps {
  name: string;
  isMuted: boolean;
  isSpeaking?: boolean;
  isHandRaised?: boolean;
  image?: string;
  initials?: string;
  children?: ReactNode;
  aspectClassName?: string;
  /** When true, removes h-full so the aspect-ratio class controls height from the container width */
  autoHeight?: boolean;
}

export function VideoParticipant({
  name,
  isMuted,
  isSpeaking = false,
  isHandRaised = false,
  image,
  initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
  children,
  aspectClassName = 'aspect-video',
  autoHeight = false,
}: VideoParticipantProps) {
  return (
    <div
      className={[
        'relative overflow-hidden rounded-lg transition-[border-color,border-width] duration-100',
        autoHeight ? 'w-full' : 'h-full w-full',
        aspectClassName,
        isSpeaking ? 'border-2 border-emerald-500' : 'border border-border',
      ].join(' ')}
    >
      <div
        className="absolute inset-0 bg-linear-to-br from-muted to-card"
        style={
          image
            ? {
                backgroundImage: `url(${image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        {children ? (
          children
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              {initials || 'P'}
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-2 pb-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">
          {isMuted ? (
            <MicOff className="h-3 w-3 shrink-0 text-red-400" />
          ) : (
            <Mic className="h-3 w-3 shrink-0 text-white/60" />
          )}
          <span className="truncate">{name}</span>
          {isHandRaised && <span className="shrink-0 text-[10px]">✋</span>}
        </div>
      </div>
    </div>
  );
}
