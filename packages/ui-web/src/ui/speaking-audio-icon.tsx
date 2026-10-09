'use client';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '@iconicedu/ui-web/lib/utils';

/** One visual for live microphone feedback across meeting surfaces and providers. */
export function SpeakingAudioIcon({
  speaking = false,
  muted = false,
  className,
}: {
  speaking?: boolean;
  muted?: boolean;
  className?: string;
}) {
  const Icon = muted ? MicOff : Mic;
  return (
    <span
      className={cn(
        'relative inline-flex size-4 shrink-0 items-center justify-center',
        className,
      )}
      data-audio-indicator
      data-speaking={speaking && !muted}
      aria-hidden="true"
    >
      <Icon className="tile-microphone-icon size-full" strokeWidth={2.25} />
      <span className="tile-speaking-bars absolute flex h-3.5 items-center gap-0.5">
        <span />
        <span />
        <span />
      </span>
      <style>{`
            [data-audio-indicator] .tile-microphone-icon,
            [data-audio-indicator] .tile-speaking-bars { transition: opacity 450ms ease-in-out; }
            [data-audio-indicator] .tile-speaking-bars { opacity: 0; }
            [data-audio-indicator][data-speaking="true"] .tile-speaking-bars { opacity: 1; }
            [data-audio-indicator][data-speaking="true"] .tile-microphone-icon { opacity: 0; }
            .tile-speaking-bars > span { width: 2px; height: 12px; border-radius: 2px; background: currentColor; transform: scaleY(.45); }
            .tile-speaking-bars > span:nth-child(2) { animation: tile-speaking-wave 1.6s ease-in-out infinite; animation-play-state: paused; }
            [data-audio-indicator][data-speaking="true"] .tile-speaking-bars > span:nth-child(2) { animation-play-state: running; }
            @keyframes tile-speaking-wave { 0%, 100% { transform: scaleY(.3); } 50% { transform: scaleY(1); } }
            @media (prefers-reduced-motion: reduce) {
              [data-audio-indicator] .tile-microphone-icon,
              [data-audio-indicator] .tile-speaking-bars { transition: none; }
              .tile-speaking-bars > span { animation: none; transform: scaleY(.5); }
              .tile-speaking-bars > span:nth-child(2) { animation: none; transform: scaleY(1); }
            }
          `}</style>
    </span>
  );
}
