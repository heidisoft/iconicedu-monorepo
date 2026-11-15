'use client';

import { formatElapsed } from './zoom-video-session.utils';

export function ZoomMeetingTimer({ elapsedSeconds }: { elapsedSeconds: number }) {
  return (
    <div className="zoom-toolbar-meta absolute left-0 flex h-12 shrink-0 items-center text-muted-foreground">
      <span className="text-sm font-medium tabular-nums text-foreground">
        {formatElapsed(elapsedSeconds)}
      </span>
    </div>
  );
}
