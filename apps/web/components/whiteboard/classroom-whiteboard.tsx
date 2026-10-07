'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Download, PanelsTopLeft, Users, ChevronDown } from 'lucide-react';
import { ErrorBoundary } from '@iconicedu/ui-web/components/error-boundary';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@iconicedu/ui-web/ui/alert-dialog';
import type { WhiteboardRepository } from '@iconicedu/web/lib/whiteboard/api';
import type { WhiteboardCollaborationProvider } from './collaboration/provider';
import type { WhiteboardEngine, WhiteboardTool } from './canvas/whiteboard-engine';
import { WhiteboardToolbar } from './components/whiteboard-toolbar';
import { WhiteboardLibrary } from './components/whiteboard-library';
import { useWhiteboard } from './use-whiteboard';
const Canvas = dynamic(
  () => import('./canvas/excalidraw-canvas').then((m) => m.ExcalidrawCanvas),
  { ssr: false, loading: () => <p role="status">Loading drawing canvas…</p> },
);

/** Video-provider-independent composition root. Inject repository and collaboration for testing. */
export function ClassroomWhiteboard({
  token,
  title = 'Class whiteboard',
  repository,
  collaboration,
}: {
  token: string;
  title?: string;
  repository?: WhiteboardRepository;
  collaboration?: WhiteboardCollaborationProvider;
}) {
  const board = useWhiteboard(token, repository, collaboration);
  const [engine, setEngine] = useState<WhiteboardEngine | null>(null);
  const [tool, setTool] = useState<WhiteboardTool>('selection');
  const [boardMenu, setBoardMenu] = useState(false);
  const [library, setLibrary] = useState(false);
  const [confirmation, setConfirmation] = useState<'clear' | 'discard' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const snapshot = board.snapshot;
  if (!snapshot)
    return (
      <section
        className="flex h-full items-center justify-center bg-card p-4"
        aria-label={title}
      >
        <div>
          <p role="status">
            {board.connection === 'reconnecting'
              ? 'Unable to load the whiteboard. Check your connection or rejoin the class.'
              : 'Loading whiteboard…'}
          </p>
          {board.connection === 'reconnecting' && (
            <Button onClick={board.retry}>Retry</Button>
          )}
        </div>
      </section>
    );
  const page = snapshot.document.pages[0];
  const teacher = snapshot.role === 'teacher';
  const editable = teacher || snapshot.document.studentEditing;
  const busy = board.saveStatus === 'saving';
  const exportRecovery = () => {
    const url = URL.createObjectURL(
      new Blob([board.recovery()], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'whiteboard-unsaved-work.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportScene = async () => {
    try {
      setExportError(null);
      if (!engine) return;
      const svg = await engine.exportSvg();
      const url = URL.createObjectURL(
        new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = 'class-whiteboard.svg';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportError('Unable to export this page. Try again.');
    }
  };
  return (
    <section
      className="classroom-whiteboard flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-background text-foreground"
      aria-label={title}
      data-testid="classroom-whiteboard"
      data-board-id={snapshot.id}
      data-element-count={page.elements.filter((e) => !e.deleted).length}
    >
      <header className="m-2 mb-0 flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card px-3 py-2 shadow-sm">
        <DropdownMenu open={boardMenu} onOpenChange={setBoardMenu}>
          <h2 className="min-w-0 max-w-56 text-sm font-medium">
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                aria-label="Board options"
                className="h-11 max-w-full gap-2 rounded-xl px-1"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <PanelsTopLeft size={17} aria-hidden="true" />
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
            <DropdownMenuItem className="min-h-11" onSelect={() => void exportScene()}>
              <Download />
              Export board
            </DropdownMenuItem>
            {teacher && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  className="min-h-11"
                  checked={snapshot.document.studentEditing}
                  disabled={busy}
                  onCheckedChange={(enabled) =>
                    board.operate({
                      id: crypto.randomUUID(),
                      type: 'student-editing',
                      enabled,
                    })
                  }
                >
                  Student editing
                </DropdownMenuCheckboxItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="order-last w-full border-t border-border/60 pt-1 md:order-0 md:w-auto md:flex-1 md:border-l md:border-t-0 md:pl-2 md:pt-0">
          <WhiteboardToolbar
            engine={engine}
            editable={editable}
            tool={tool}
            onTool={setTool}
            canClear={teacher}
            onClear={() => setConfirmation('clear')}
            onLibrary={() => setLibrary(!library)}
            libraryOpen={library}
          />
        </div>
        <span
          role="status"
          aria-live="polite"
          className="ml-auto text-xs text-muted-foreground"
        >
          {board.connection !== 'connected'
            ? 'Reconnecting…'
            : board.saveStatus === 'saved'
              ? 'Saved'
              : board.saveStatus === 'saving'
                ? 'Saving…'
                : 'Unsaved · retrying'}
        </span>
        <div
          aria-label="Whiteboard participants"
          className="flex items-center gap-2 border-l border-border/60 pl-3"
        >
          <Users size={16} className="text-muted-foreground" aria-hidden="true" />
          <div className="flex -space-x-2">
            {snapshot.presence.slice(0, 4).map((p, index) => (
              <span
                key={p.id}
                role="img"
                title={`${p.name}${p.role === 'teacher' ? ' (teacher)' : ''}`}
                aria-label={`${p.name}${p.role === 'teacher' ? ' (teacher)' : ''}`}
                className={`flex size-8 items-center justify-center rounded-full border-2 border-card text-[11px] font-medium ${index % 3 === 0 ? 'bg-primary/15 text-primary' : index % 3 === 1 ? 'bg-secondary text-secondary-foreground' : 'bg-accent text-accent-foreground'}`}
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
            {snapshot.presence.length > 4 && (
              <span
                className="flex size-8 items-center justify-center rounded-full border-2 border-card bg-muted text-[11px] text-muted-foreground"
                aria-label={`${snapshot.presence.length - 4} more participants`}
              >
                +{snapshot.presence.length - 4}
              </span>
            )}
          </div>
        </div>
      </header>
      {(board.error || exportError) && (
        <div role="alert" className="flex items-center gap-2 px-3 py-1 text-sm">
          {board.error ?? exportError}
          <Button size="sm" variant="outline" onClick={board.retry}>
            Retry save
          </Button>
          {board.error && (
            <>
              <Button size="sm" variant="outline" onClick={exportRecovery}>
                Download unsaved work
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmation('discard')}
              >
                Discard unsaved changes
              </Button>
            </>
          )}
        </div>
      )}
      {!editable && (
        <p className="px-3 py-1 text-sm text-muted-foreground">
          Your teacher has locked student editing.
        </p>
      )}
      <div className="relative m-2 flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/50 bg-card">
        <ErrorBoundary
          key={page.id}
          fallback={
            <div role="alert" className="p-4">
              The whiteboard could not be rendered. Rejoin the class to retry.
            </div>
          }
        >
          <Canvas
            key={page.id}
            elements={page.elements}
            editable={editable}
            onChange={board.changeElements}
            onEngine={setEngine}
            onToolChange={setTool}
          />
        </ErrorBoundary>
        {library && (
          <WhiteboardLibrary
            disabled={!editable || !engine}
            onInsert={(asset) => {
              try {
                engine?.insertAsset(asset);
                setLibrary(false);
              } catch {
                setExportError('Unable to insert this educational asset.');
              }
            }}
          />
        )}
        <p className="pointer-events-none absolute bottom-3 left-3 hidden rounded-xl border border-border/50 bg-card/90 px-3 py-1.5 text-[11px] text-muted-foreground sm:block">
          Scroll to pan · Space + drag · Ctrl/⌘ + scroll to zoom
        </p>
      </div>
      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation === 'clear'
                ? 'Clear the whiteboard?'
                : 'Discard unsaved changes?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation === 'discard'
                ? 'Download your unsaved work first. This restores the saved board and removes pending local changes.'
                : 'This removes the whiteboard content for everyone in this class.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmation === 'discard') board.discard();
                else if (confirmation === 'clear')
                  board.operate({
                    id: crypto.randomUUID(),
                    type: 'clear-page',
                    pageId: page.id,
                  });
                setConfirmation(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
