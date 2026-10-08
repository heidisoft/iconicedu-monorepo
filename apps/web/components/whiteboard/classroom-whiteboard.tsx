'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { ErrorBoundary } from '@iconicedu/ui-web/components/error-boundary';
import { Button } from '@iconicedu/ui-web/ui/button';
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
import { WhiteboardBoardDetails } from './components/whiteboard-board-details';
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
  const exportScene = async (format: 'svg' | 'png' = 'svg') => {
    try {
      setExportError(null);
      if (!engine) return;
      const blob =
        format === 'png'
          ? await engine.exportPng()
          : new Blob([new XMLSerializer().serializeToString(await engine.exportSvg())], {
              type: 'image/svg+xml',
            });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `class-whiteboard.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportError('Unable to export this board. Try again.');
    }
  };
  return (
    <section
      className="classroom-whiteboard @container relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-background text-foreground"
      aria-label={title}
      data-testid="classroom-whiteboard"
      data-board-id={snapshot.id}
      data-element-count={page.elements.filter((e) => !e.deleted).length}
    >
      <div className="pointer-events-none absolute inset-x-3 top-3 z-20 grid grid-cols-1 items-start gap-2 @min-[760px]:grid-cols-[minmax(0,1fr)_auto]">
        <WhiteboardBoardDetails
          title={title}
          presence={snapshot.presence}
          connection={board.connection}
          saveStatus={board.saveStatus}
          teacher={teacher}
          studentEditing={snapshot.document.studentEditing}
          busy={busy}
          onExport={(format) => void exportScene(format)}
          onStudentEditing={(enabled) =>
            board.operate({ id: crypto.randomUUID(), type: 'student-editing', enabled })
          }
        />
        <aside
          data-testid="whiteboard-overlay-toolbar"
          aria-label="Drawing controls"
          className="pointer-events-auto col-start-1 row-start-2 @min-[760px]:row-start-1 justify-self-start max-w-full w-fit overflow-x-auto rounded-md border border-border bg-card p-1 shadow-sm"
        >
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
        </aside>
      </div>
      <div className="absolute inset-x-3 bottom-12 z-20 flex flex-col gap-2">
        {(board.error || exportError) && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-sm shadow-sm"
          >
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
          <p className="w-fit rounded-xl border border-border/60 bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm">
            The presenter has disabled participant annotations.
          </p>
        )}
      </div>
      <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-2xl bg-card">
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
            tool={tool}
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
        <p
          data-whiteboard-hint
          className="pointer-events-none absolute bottom-3 left-3 hidden rounded-xl border border-border/50 bg-card/90 px-3 py-1.5 text-[11px] text-muted-foreground sm:block"
        >
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
