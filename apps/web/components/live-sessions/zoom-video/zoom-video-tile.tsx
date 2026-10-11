'use client';

import { useCallback, useEffect, useRef, useState, type Ref } from 'react';
import { Hand, Video, VideoOff } from 'lucide-react';

import { SpeakingAudioIcon } from '@iconicedu/ui-web/ui/speaking-audio-icon';
import { Avatar, AvatarFallback, AvatarImage } from '@iconicedu/ui-web/ui/avatar';
import { cn, getInitials } from '@iconicedu/ui-web/lib/utils';
import {
  useFocusedFullscreen,
  FocusedFullscreenButton,
  FocusedFullscreenStyles,
} from './focused-fullscreen';
import { OverlayBadge } from './zoom-meeting-controls';

function TileMediaStatus({
  kind,
  enabled,
  compact = false,
  speakingLabel,
}: {
  kind: 'microphone' | 'camera';
  enabled: boolean;
  compact?: boolean;
  speakingLabel?: string;
}) {
  const Icon = enabled ? Video : VideoOff;
  const label = `${kind === 'microphone' ? 'Microphone' : 'Camera'} ${enabled ? 'on' : 'off'}`;
  const isSpeaking = kind === 'microphone' && enabled && !!speakingLabel;

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full bg-black/45 text-white shadow-sm backdrop-blur-lg',
        compact ? 'size-6' : 'size-8',
        !enabled && 'text-destructive',
      )}
      data-tile-audio={kind === 'microphone' ? '' : undefined}
      data-speaking={isSpeaking}
      aria-label={isSpeaking ? speakingLabel : label}
      title={isSpeaking ? speakingLabel : label}
    >
      {kind === 'microphone' ? (
        <SpeakingAudioIcon
          speaking={isSpeaking}
          muted={!enabled}
          className={compact ? 'size-3' : 'size-4'}
        />
      ) : (
        <Icon
          className={compact ? 'size-3' : 'size-4'}
          strokeWidth={2.25}
          aria-hidden="true"
        />
      )}
    </span>
  );
}

export function ZoomVideoTile({
  label,
  avatarUrl,
  isSelf,
  isMuted,
  isVideoOn,
  videoContainerRef,
  className,
  handRaised,
  handPosition = 'right',
  density = 'default',
  isSpeaking: speaking = false,
  fullscreenFeatured = false,
}: {
  label: string;
  avatarUrl?: string;
  isSelf: boolean;
  isMuted: boolean;
  isVideoOn: boolean;
  videoContainerRef: Ref<HTMLDivElement>;
  className?: string;
  handRaised?: boolean;
  handPosition?: 'left' | 'right';
  density?: 'default' | 'compact';
  isSpeaking?: boolean;
  fullscreenFeatured?: boolean;
}) {
  const isSpeaking = speaking && !isMuted;
  const fullscreen = useFocusedFullscreen();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [rendererReady, setRendererReady] = useState(false);
  const setSurfaceRef = useCallback(
    (element: HTMLDivElement | null) => {
      surfaceRef.current = element;
      if (typeof videoContainerRef === 'function') videoContainerRef(element);
      else if (videoContainerRef) videoContainerRef.current = element;
    },
    [videoContainerRef],
  );

  useEffect(() => {
    setRendererReady(false);
    const surface = surfaceRef.current;
    if (!isVideoOn || !surface) return;
    let frame = 0;
    const checkRenderer = () => {
      cancelAnimationFrame(frame);
      if (!surface.querySelector('video-player')) {
        setRendererReady(false);
        return;
      }
      // Allow the attached surface a browser paint opportunity before revealing
      // it. Attachment is not a guarantee that Zoom has delivered its first frame.
      frame = requestAnimationFrame(() => setRendererReady(true));
    };
    const observer = new MutationObserver(checkRenderer);
    observer.observe(surface, { childList: true, subtree: true });
    checkRenderer();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [isVideoOn]);
  const revealVideo = isVideoOn && rendererReady;
  const compact = density === 'compact';

  return (
    <div
      ref={fullscreen.setTarget}
      data-focused-content="video"
      data-self-video={isSelf}
      data-fullscreen-featured={fullscreenFeatured}
      className={cn(
        'zoom-video-tile relative isolate overflow-hidden bg-secondary shadow-inner transition-[inset,width,height,transform,opacity,box-shadow] duration-500 ease-out motion-reduce:transition-none',
        compact ? 'rounded-2xl' : 'rounded-3xl sm:rounded-[2rem]',
        isSpeaking && 'ring-2 ring-inset ring-primary',
        className,
      )}
    >
      <FocusedFullscreenStyles />
      <FocusedFullscreenButton fullscreen={fullscreen} label={`${label} video`} />
      <div
        ref={setSurfaceRef}
        className="absolute inset-0 z-0 h-full w-full [&>video-player-container]:block [&>video-player-container]:h-full [&>video-player-container]:w-full [&_video-player]:h-full [&_video-player]:w-full [&_video-player]:object-cover"
      />
      <div
        data-camera-placeholder
        aria-hidden={revealVideo}
        className={cn(
          'pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-secondary motion-reduce:transition-none',
          revealVideo
            ? 'opacity-0 transition-opacity duration-200 ease-out'
            : 'opacity-100',
        )}
      >
        <Avatar
          size="lg"
          className="aspect-square shrink-0 bg-background/90 text-foreground shadow-sm ring-4 ring-background/50"
          style={{ height: 'clamp(4rem, 36%, 11rem)', width: 'auto' }}
        >
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className="bg-background/90 text-base font-medium text-foreground sm:text-2xl">
            {getInitials(label)}
          </AvatarFallback>
        </Avatar>
      </div>
      {handRaised ? (
        <span
          className={cn(
            'absolute z-30 inline-flex shrink-0 animate-in items-center justify-center gap-1.5 rounded-full bg-amber-400 font-semibold text-amber-950 shadow-lg ring-2 ring-white/80 zoom-in-75 backdrop-blur-lg',
            compact ? 'top-2 size-9' : 'top-4 h-11 px-3 sm:h-12 sm:px-4',
            handPosition === 'left'
              ? compact
                ? 'left-2'
                : 'left-4'
              : compact
                ? 'right-2'
                : 'right-4',
          )}
          data-tile-overlay
          aria-label="Hand raised"
          title="Hand raised"
        >
          <Hand
            className={compact ? 'size-4.5' : 'size-5 sm:size-6'}
            strokeWidth={2.5}
            aria-hidden="true"
          />
          {compact ? null : <span className="text-xs sm:text-sm">Hand raised</span>}
        </span>
      ) : null}
      <div
        className={cn(
          'absolute z-30 flex min-w-0 items-center',
          compact ? 'gap-1' : 'gap-1.5',
        )}
        style={
          compact
            ? { left: '0.5rem', right: '3rem', bottom: '0.5rem' }
            : { left: '1rem', right: '3.5rem', bottom: '1rem' }
        }
        data-tile-overlay
        aria-label={`${label} status`}
      >
        <OverlayBadge
          className={cn(
            'min-w-0 bg-black/45 py-0 font-medium text-white shadow-sm backdrop-blur-lg',
            compact ? 'h-6 px-2 text-[10px]' : 'h-8 px-3 text-xs',
          )}
        >
          <span className="min-w-0 truncate">
            {label}
            {isSelf ? ' (You)' : ''}
          </span>
        </OverlayBadge>
        <TileMediaStatus
          kind="microphone"
          enabled={!isMuted}
          compact={compact}
          speakingLabel={isSpeaking ? `${label} is speaking` : undefined}
        />
        <TileMediaStatus kind="camera" enabled={isVideoOn} compact={compact} />
      </div>
    </div>
  );
}
