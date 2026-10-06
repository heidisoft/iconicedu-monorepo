'use client';
import { Copy, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { IconActionButton } from '@iconicedu/ui-web/ui/icon-action-button';
import type { WhiteboardPageVM } from '@iconicedu/shared-types';
export function WhiteboardPages({
  pages,
  activeId,
  teacher,
  busy,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onMove,
}: {
  pages: WhiteboardPageVM[];
  activeId: string;
  teacher: boolean;
  busy: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: () => void;
}) {
  return (
    <footer className="flex shrink-0 items-center gap-2 overflow-x-auto border-t border-border bg-card p-2">
      <label className="text-sm">
        Page{' '}
        <select
          aria-label="Current page"
          className="min-h-11 rounded border border-border bg-background px-2"
          value={activeId}
          onChange={(e) => onSelect(e.target.value)}
        >
          {pages.map((page, i) => (
            <option key={page.id} value={page.id}>
              {i + 1} — {page.title}
            </option>
          ))}
        </select>
      </label>
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        of {pages.length}
      </span>
      {teacher && (
        <>
          <IconActionButton
            variant="ghost"
            label="Add page"
            disabled={busy}
            onClick={onAdd}
            className="h-11 w-11 shrink-0"
          >
            <Plus className="h-5 w-5" />
          </IconActionButton>
          <IconActionButton
            variant="ghost"
            label="Duplicate page"
            disabled={busy}
            onClick={onDuplicate}
            className="h-11 w-11 shrink-0"
          >
            <Copy className="h-5 w-5" />
          </IconActionButton>
          <IconActionButton
            variant="ghost"
            label="Move page earlier"
            disabled={busy || pages[0].id === activeId}
            onClick={onMove}
            className="h-11 w-11 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </IconActionButton>
          <IconActionButton
            variant="ghost"
            label="Delete page"
            disabled={busy || pages.length === 1}
            onClick={onDelete}
            className="h-11 w-11 shrink-0"
          >
            <Trash2 className="h-5 w-5" />
          </IconActionButton>
        </>
      )}
    </footer>
  );
}
