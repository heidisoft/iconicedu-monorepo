'use client';

import type { ReactNode } from 'react';
import { SpeakingAudioIcon } from '@iconicedu/ui-web/ui/speaking-audio-icon';
import { useSpeakingHold } from '@iconicedu/ui-web/hooks/use-speaking-hold';

interface VideoParticipantProps {
  name: string;
  isMuted: boolean;
  isActive: boolean;
  isSpeaking?: boolean;
  image?: string;
  initials?: string;
  children?: ReactNode;
  aspectClassName?: string;
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
  aspectClassName = 'aspect-[16/9]',
}: VideoParticipantProps) {
  const speaking = useSpeakingHold(isSpeaking, !isMuted);
  return (
    <div
      className={[
        'relative h-full w-full overflow-hidden rounded-lg border bg-card shadow-[0_12px_40px_rgba(15,23,42,0.18)] transition-all duration-300 dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)]',
        aspectClassName,
        isActive || speaking
          ? 'border-primary/80 ring-2 ring-primary/70'
          : 'border-border ring-0',
      ].join(' ')}
    >
      <div
        className="absolute inset-0 bg-gradient-to-br from-muted to-card"
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

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-background/90 to-transparent px-4 py-3">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <span>{name}</span>
          <span
            aria-label={
              speaking ? `${name} is speaking` : `Microphone ${isMuted ? 'off' : 'on'}`
            }
          >
            <SpeakingAudioIcon speaking={speaking} muted={isMuted} />
          </span>
        </div>
      </div>
    </div>
  );
}
