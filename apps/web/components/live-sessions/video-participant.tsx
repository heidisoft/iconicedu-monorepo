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
  return (
    <div
      className={[
        'relative h-full w-full overflow-hidden rounded-[18px] border bg-zinc-950 shadow-[0_12px_40px_rgba(0,0,0,0.35)] transition-all duration-300',
        aspectClassName,
        isActive ? 'border-primary/80 ring-2 ring-primary/70' : 'border-white/10 ring-0',
      ].join(' ')}
    >
      <div
        className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900"
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
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_34%),linear-gradient(180deg,rgba(44,44,50,1),rgba(32,32,37,1))]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-slate-700/90 text-2xl font-semibold text-white shadow-[0_0_0_10px_rgba(99,102,241,0.08)]">
              {initials || 'P'}
            </div>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-4">
        <div className="inline-flex items-center gap-2 text-white">
          {isMuted ? (
            <MicOff className="h-4 w-4 text-white/95 drop-shadow-sm" />
          ) : (
            <Mic className="h-4 w-4 text-white/95 drop-shadow-sm" />
          )}
          <span className="text-[15px] font-medium drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] md:text-[16px]">
            {name}
          </span>
        </div>
      </div>

      <div className="absolute right-3 top-3 flex items-center justify-center rounded-full bg-primary p-2 shadow-lg">
        {isSpeaking ? (
          <div className="flex items-end gap-0.5">
            {[10, 20, 14, 24, 16].map((height, index) => (
              <span
                key={`${name}-wave-${index}`}
                className="w-[3px] animate-pulse rounded-full bg-primary-foreground"
                style={{
                  height: `${Math.max(8, height - 2)}px`,
                  animationDelay: `${index * 120}ms`,
                }}
              />
            ))}
          </div>
        ) : (
          <Radio className="h-4 w-4 text-primary-foreground" />
        )}
      </div>
    </div>
  );
}
