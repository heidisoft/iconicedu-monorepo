'use client';
import { useState } from 'react';
import { Download, PanelsTopLeft, Users, ChevronDown } from 'lucide-react';
import type { WhiteboardSnapshotVM } from '@iconicedu/shared-types';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
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
  const [boardMenu, setBoardMenu] = useState(false);
  return (
    <header
      data-testid="whiteboard-board-details"
      className="pointer-events-auto relative col-start-1 row-start-1 @min-[760px]:col-start-2 justify-self-end flex max-w-full flex-wrap items-center justify-end gap-1.5 rounded-md border border-border bg-card px-2 py-1 shadow-sm"
    >
      <DropdownMenu open={boardMenu} onOpenChange={setBoardMenu}>
        <h2 className="min-w-0 max-w-48 flex-1 text-sm font-medium">
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              aria-label="Board options"
              className="h-8 max-w-full gap-2 rounded-sm px-1"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
                <PanelsTopLeft size={15} aria-hidden="true" />
              </span>
              <span className="truncate" title={title}>
                {title}
              </span>
              <ChevronDown
                size={14}
                className="shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </Button>
          </DropdownMenuTrigger>
        </h2>
        <DropdownMenuContent
          container={
            typeof document === 'undefined' ? undefined : document.fullscreenElement
          }
          className="w-60 border border-border/60 shadow-sm"
        >
          <DropdownMenuLabel>Board options</DropdownMenuLabel>
          <DropdownMenuItem className="min-h-11" onSelect={() => onExport('svg')}>
            <Download />
            Export board
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11" onSelect={() => onExport('png')}>
            <Download />
            Export PNG
          </DropdownMenuItem>
          {teacher && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                className="min-h-11"
                checked={studentEditing}
                disabled={busy}
                onCheckedChange={onStudentEditing}
              >
                Allow participants to annotate
              </DropdownMenuCheckboxItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
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
    </header>
  );
}
