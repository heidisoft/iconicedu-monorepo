'use client';

import type { RecordingStatus } from '@zoom/videosdk';

import { cn } from '@iconicedu/ui-web/lib/utils';

export function ZoomRecordingIndicator({ status }: { status: RecordingStatus | null }) {
  const isRecording = status === 'Recording';
  const isPaused = status === 'Paused';
  const label = isPaused ? 'Paused' : 'Recording';

  return (
    <div
      className="flex h-8 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-semibold uppercase tracking-wide text-card-foreground shadow-sm"
      role="status"
      aria-live="polite"
      aria-label={
        isRecording
          ? 'Recording in progress'
          : isPaused
            ? 'Recording paused'
            : 'Not recording'
      }
    >
      <span
        className={cn(
          'size-2 rounded-full',
          isRecording
            ? 'animate-pulse bg-destructive'
            : isPaused
              ? 'bg-warning'
              : 'bg-muted-foreground/60',
        )}
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}
