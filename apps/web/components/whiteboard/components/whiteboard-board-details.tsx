'use client';
import { Download, Users } from 'lucide-react';
import type { WhiteboardSnapshotVM } from '@iconicedu/shared-types';
import {
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@iconicedu/ui-web/ui/dropdown-menu';
export function WhiteboardBoardDetails({
  title,
  presence,
  connection,
  saveStatus,
  teacher,
  studentEditing,
  busy,
  onExport,
  onStudentEditing,
}: {
  title: string;
  presence: WhiteboardSnapshotVM['presence'];
  connection: string;
  saveStatus: string;
  teacher: boolean;
  studentEditing: boolean;
  busy: boolean;
  onExport: (format: 'svg' | 'png') => void;
  onStudentEditing: (enabled: boolean) => void;
}) {
  return (
    <>
      <DropdownMenuLabel>{title}</DropdownMenuLabel>
      <span
        role="status"
        aria-live="polite"
        className="ml-auto text-xs text-muted-foreground"
      >
        {connection !== 'connected'
          ? 'Reconnecting…'
          : saveStatus === 'saved'
            ? 'Saved'
            : saveStatus === 'saving'
              ? 'Saving…'
              : 'Unsaved · retrying'}
      </span>
      <div
        aria-label="Whiteboard participants"
        className="flex items-center gap-1.5 border-l border-border/60 pl-2"
      >
        <Users size={14} className="text-muted-foreground" aria-hidden="true" />
        <div className="flex -space-x-2">
          {presence.slice(0, 4).map((p, index) => (
            <span
              key={p.id}
              role="img"
              title={`${p.name}${p.role === 'teacher' ? ' (teacher)' : ''}`}
              aria-label={`${p.name}${p.role === 'teacher' ? ' (teacher)' : ''}`}
              className={`flex size-6 items-center justify-center rounded-full border-2 border-card text-[11px] font-medium ${index % 3 === 0 ? 'bg-primary/15 text-primary' : index % 3 === 1 ? 'bg-secondary text-secondary-foreground' : 'bg-accent text-accent-foreground'}`}
            >
              {p.name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join('')
                .toUpperCase() || '?'}
            </span>
          ))}
          {presence.length > 4 && (
            <span
              className="flex size-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[11px] text-muted-foreground"
              aria-label={`${presence.length - 4} more participants`}
            >
              +{presence.length - 4}
            </span>
          )}
        </div>
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="min-h-11" onSelect={() => onExport('svg')}>
        <Download />
        Export board
      </DropdownMenuItem>
      <DropdownMenuItem className="min-h-11" onSelect={() => onExport('png')}>
        <Download />
        Export PNG
      </DropdownMenuItem>
      {teacher && (
        <DropdownMenuCheckboxItem
          className="min-h-11"
          checked={studentEditing}
          disabled={busy}
          onCheckedChange={onStudentEditing}
        >
          Allow participants to annotate
        </DropdownMenuCheckboxItem>
      )}
    </>
  );
}
