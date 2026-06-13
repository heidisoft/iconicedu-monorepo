'use client';

import type { ReactNode } from 'react';
import { Mic, MicOff, Radio } from 'lucide-react';

interface VideoParticipantProps {
  name: string;
  isMuted: boolean;
  isActive: boolean;
  isSpeaking?: boolean;
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
  isActive,
  isSpeaking = false,
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
        'relative overflow-hidden rounded-lg border bg-card shadow-[0_12px_40px_rgba(15,23,42,0.18)] transition-all duration-300 dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)]',
        autoHeight ? 'w-full' : 'h-full w-full',
        aspectClassName,
        isActive ? 'border-primary/80 ring-2 ring-primary/70' : 'border-border ring-0',
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
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                {initials || 'P'}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background/80 via-transparent to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-linear-to-t from-background/90 to-transparent px-3 py-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
          {isMuted ? (
            <MicOff className="h-3.5 w-3.5 text-foreground" />
          ) : (
            <Mic className="h-3.5 w-3.5 text-foreground" />
          )}
          <span className="truncate">{name}</span>
        </div>
      </div>

      <div className="absolute right-2 top-2 flex items-center justify-center rounded-full bg-primary p-1.5 shadow-lg">
        {isSpeaking ? (
          <div className="flex items-end gap-0.5">
            {[8, 14, 10, 18, 12].map((height, index) => (
              <span
                key={`${name}-wave-${index}`}
                className="w-0.5 animate-pulse rounded-full bg-primary-foreground"
                style={{
                  height: `${height}px`,
                  animationDelay: `${index * 90}ms`,
                }}
              />
            ))}
          </div>
        ) : (
          <Radio className="h-3.5 w-3.5 text-primary-foreground" />
        )}
      </div>
    </div>
  );
}
