'use client';

import { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause } from 'lucide-react';
import type { AudioRecordingMessageVM } from '@iconicedu/shared-types';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  MessageBase,
  type MessageBaseProps,
} from '@iconicedu/ui-web/components/messages/message-base';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { buildFileAccessHref } from '@iconicedu/ui-web/components/messages/file-download.utils';
import { MessageTextContent } from '@iconicedu/ui-web/components/messages/message-text-content';

interface AudioMessageProps extends Omit<MessageBaseProps, 'message' | 'children'> {
  message: AudioRecordingMessageVM;
}

const DEFAULT_BAR_COUNT = 28;

export function formatAudioTime(time: number) {
  const safeTime = Math.max(0, Math.floor(time));
  const minutes = Math.floor(safeTime / 60);
  const seconds = safeTime % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function buildAudioWaveformBars(
  waveform: number[] | undefined,
  count = DEFAULT_BAR_COUNT,
) {
  if (waveform?.length) {
    return waveform.slice(0, count).map((value) => Math.max(0.2, Math.min(1, value)));
  }

  return Array.from({ length: count }, (_, index) => {
    const curve = Math.sin(((index + 2) / count) * Math.PI * 1.3);
    return Math.max(0.28, Math.min(0.92, 0.55 + curve * 0.28));
  });
}

export function resolveAudioDuration(
  messageDurationSeconds?: number,
  loadedDuration?: number,
) {
  const safeMessageDuration =
    typeof messageDurationSeconds === 'number' && Number.isFinite(messageDurationSeconds)
      ? messageDurationSeconds
      : 0;
  const safeLoadedDuration =
    typeof loadedDuration === 'number' && Number.isFinite(loadedDuration)
      ? loadedDuration
      : 0;

  return Math.max(0, safeMessageDuration, safeLoadedDuration);
}

export const AudioMessage = memo(function AudioMessage(props: AudioMessageProps) {
  const { message, ...baseProps } = props;
  const isFeedTheme = baseProps.messageUiThemeKey === 'feed';
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(message.audio.durationSeconds ?? 0);
  const [canPlay, setCanPlay] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [pendingPlay, setPendingPlay] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformBars = useMemo(
    () => buildAudioWaveformBars(message.audio.waveform),
    [message.audio.waveform],
  );

  useEffect(() => {
    setAudioSrc(null);
    setPendingPlay(false);
    setCanPlay(false);
    setIsPlaying(false);
    setCurrentTime(0);
  }, [message.ids.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => {
      const nextDuration =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : (message.audio.durationSeconds ?? 0);
      setDuration(nextDuration);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handleCanPlay = () => setCanPlay(true);
    const handleError = () => setCanPlay(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
    };
  }, [message.audio.durationSeconds]);

  useEffect(() => {
    if (!pendingPlay || !audioSrc || !audioRef.current) {
      return;
    }

    const playResult = audioRef.current.play();
    if (playResult && typeof playResult.then === 'function') {
      void playResult
        .then(() => {
          setCanPlay(true);
          setIsPlaying(true);
          setPendingPlay(false);
        })
        .catch(() => {
          setIsPlaying(false);
          setPendingPlay(false);
        });
      return;
    }

    setCanPlay(true);
    setIsPlaying(true);
    setPendingPlay(false);
  }, [audioSrc, pendingPlay]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if (!audioSrc) {
      setAudioSrc(
        buildFileAccessHref({
          url: message.audio.url,
          storagePath: message.audio.storagePath,
        }),
      );
      setPendingPlay(true);
      return;
    }

    const playResult = audioRef.current.play();
    if (playResult && typeof playResult.then === 'function') {
      void playResult
        .then(() => {
          setCanPlay(true);
          setIsPlaying(true);
        })
        .catch(() => {
          setIsPlaying(false);
        });
      return;
    }

    setCanPlay(true);
    setIsPlaying(true);
  }, [audioSrc, isPlaying, message.audio.storagePath, message.audio.url]);

  const seekToRatio = useCallback(
    (ratio: number) => {
      const audio = audioRef.current;
      if (!audio || !duration) return;
      const boundedRatio = Math.max(0, Math.min(1, ratio));
      const nextTime = boundedRatio * duration;
      audio.currentTime = nextTime;
      setCurrentTime(nextTime);
    },
    [duration],
  );

  const handleWaveformClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      if (!rect.width) return;
      seekToRatio((event.clientX - rect.left) / rect.width);
    },
    [seekToRatio],
  );

  const handleWaveformKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!duration) return;

      if (event.key === 'Home') {
        event.preventDefault();
        seekToRatio(0);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        seekToRatio(1);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        seekToRatio((currentTime + 5) / duration);
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        seekToRatio((currentTime - 5) / duration);
      }
    },
    [currentTime, duration, seekToRatio],
  );

  const resolvedDuration = resolveAudioDuration(message.audio.durationSeconds, duration);
  const progressRatio = resolvedDuration > 0 ? currentTime / resolvedDuration : 0;

  return (
    <MessageBase message={message} {...baseProps}>
      {!isFeedTheme && message.content?.text && (
        <MessageTextContent text={message.content.text} className="mb-3" />
      )}
      <div className="max-w-md rounded-2xl border border-border bg-card px-3 py-3">
        <audio
          ref={audioRef}
          src={audioSrc ?? undefined}
          preload="none"
          aria-label="Audio message"
        />
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={togglePlayPause}
            size="icon"
            className={cn(
              'h-10 w-10 rounded-full border border-primary/20 bg-primary/12 text-primary transition-colors hover:bg-primary/18',
              isPlaying && 'bg-primary text-primary-foreground hover:bg-primary/90',
              !canPlay && 'opacity-80',
            )}
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            )}
          </Button>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{formatAudioTime(currentTime)}</span>
              <span>{formatAudioTime(resolvedDuration)}</span>
            </div>
            <div
              role="slider"
              tabIndex={canPlay ? 0 : -1}
              aria-label="Audio progress"
              aria-valuemin={0}
              aria-valuemax={Math.round(resolvedDuration)}
              aria-valuenow={Math.round(currentTime)}
              aria-valuetext={`${formatAudioTime(currentTime)} of ${formatAudioTime(resolvedDuration)}`}
              className={cn(
                'flex h-6 cursor-pointer items-end gap-0.5 rounded-xl border border-border/70 bg-muted/70 px-2 outline-none',
                canPlay
                  ? 'focus-visible:ring-2 focus-visible:ring-ring'
                  : 'cursor-not-allowed opacity-60',
              )}
              onClick={canPlay ? handleWaveformClick : undefined}
              onKeyDown={canPlay ? handleWaveformKeyDown : undefined}
            >
              {waveformBars.map((barHeight, index) => {
                const isActive = progressRatio >= (index + 1) / waveformBars.length;
                return (
                  <span
                    key={index}
                    className={cn(
                      'min-w-[3px] flex-1 rounded-full transition-colors',
                      isActive ? 'bg-primary' : 'bg-foreground/20',
                    )}
                    style={{ height: `${Math.max(8, Math.round(barHeight * 16))}px` }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {isFeedTheme && message.content?.text && (
        <MessageTextContent
          text={message.content.text}
          className="mt-3 rounded-[10px] border border-border/70 bg-background px-4 py-3"
        />
      )}
    </MessageBase>
  );
});
