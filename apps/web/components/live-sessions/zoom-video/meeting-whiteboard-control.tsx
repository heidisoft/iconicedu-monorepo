'use client';

import { Eye, EyeOff, Presentation, Square } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@iconicedu/ui-web/ui/dropdown-menu';
import { MeetingControlButton } from './zoom-meeting-controls';

/** Local visibility never changes the presentation shared with the class. */
export function MeetingWhiteboardControl({
  visible,
  presenting,
  canStop,
  active = visible || canStop,
  disabled = false,
  onToggle,
  onStop,
}: {
  visible: boolean;
  presenting: boolean;
  canStop: boolean;
  active?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onStop: () => void;
}) {
  if (!active)
    return (
      <MeetingControlButton
        label="Start whiteboard"
        onClick={onToggle}
        disabled={disabled}
      >
        <Presentation className="size-4" />
      </MeetingControlButton>
    );
  const VisibilityIcon = visible ? EyeOff : Eye;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MeetingControlButton
          label="Whiteboard options"
          tone={visible || presenting ? 'active' : 'neutral'}
        >
          <Presentation className="size-4" />
        </MeetingControlButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top">
        <DropdownMenuItem onSelect={onToggle}>
          <VisibilityIcon className="size-4" />
          {visible ? 'Hide whiteboard for me' : 'Show whiteboard'}
        </DropdownMenuItem>
        {canStop && (
          <DropdownMenuItem onSelect={onStop}>
            <Square className="size-4" />
            Stop sharing for everyone
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
