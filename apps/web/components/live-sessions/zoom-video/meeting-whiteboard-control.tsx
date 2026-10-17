'use client';

import { Presentation } from 'lucide-react';
import { MeetingControlButton } from './zoom-meeting-controls';

/** Start or stop the class presentation directly, preserving stop permissions. */
export function MeetingWhiteboardControl({
  visible,
  presenting,
  canStop,
  onToggle,
  onStop,
}: {
  visible: boolean;
  presenting: boolean;
  canStop: boolean;
  onToggle: () => void;
  onStop: () => void;
}) {
  const viewing = visible && !canStop;
  return (
    <MeetingControlButton
      label={
        canStop
          ? 'Stop presenting whiteboard'
          : viewing
            ? 'Whiteboard is being presented'
            : 'Open whiteboard'
      }
      tooltip={
        viewing ? 'Only the presenter or a tutor can stop the whiteboard' : undefined
      }
      tone={presenting ? 'active' : 'neutral'}
      disabled={viewing}
      onClick={canStop ? onStop : onToggle}
    >
      <Presentation className="size-4" />
    </MeetingControlButton>
  );
}
