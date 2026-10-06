'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Library, Download } from 'lucide-react';
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
import { WhiteboardToolbar } from './components/whiteboard-toolbar';
import { WhiteboardPages } from './components/whiteboard-pages';
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
  const [confirmation, setConfirmation] = useState<'clear' | 'delete' | 'discard' | null>(
    null,
  );
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
  const page =
    snapshot.document.pages.find((p) => p.id === board.pageId) ??
    snapshot.document.pages[0];
  const teacher = snapshot.role === 'teacher';
  const editable = teacher || snapshot.document.studentEditing;
  const busy = board.saveStatus === 'saving';
  const add = (sourceId?: string) =>
    board.operate({
      id: crypto.randomUUID(),
      type: 'add-page',
      pageId: crypto.randomUUID(),
      title: `Page ${snapshot.document.pages.length + 1}`,
      sourceId,
    });
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
      className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground"
      aria-label={title}
      data-testid="classroom-whiteboard"
      data-board-id={snapshot.id}
      data-element-count={page.elements.filter((e) => !e.deleted).length}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
        <h2 className="mr-auto text-sm font-semibold">{title}</h2>
        <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {board.connection !== 'connected'
            ? 'Reconnecting…'
            : board.saveStatus === 'saved'
              ? 'Saved'
              : board.saveStatus === 'saving'
                ? 'Saving…'
                : 'Unsaved · retrying'}
        </span>
        <Button
          size="sm"
          variant="outline"
          aria-expanded={library}
          onClick={() => setLibrary(!library)}
        >
          <Library className="mr-1 h-4 w-4" />
          Library
        </Button>
        <Button size="sm" variant="outline" onClick={() => void exportScene()}>
          <Download className="mr-1 h-4 w-4" />
          Export page
        </Button>
        {teacher && (
          <label className="flex min-h-11 items-center gap-2 text-xs">
            <input
              type="checkbox"
              aria-label="Student editing"
              checked={snapshot.document.studentEditing}
              disabled={busy}
              onChange={(e) =>
                board.operate({
                  id: crypto.randomUUID(),
                  type: 'student-editing',
                  enabled: e.target.checked,
                })
              }
            />
            Student editing
          </label>
        )}
      </header>
      <div
        aria-label="Whiteboard participants"
        className="flex shrink-0 gap-3 overflow-x-auto px-3 py-1 text-xs text-muted-foreground"
      >
        {snapshot.presence.map((p) => (
          <span key={p.id} className="whitespace-nowrap">
            ● {p.name}
            {p.role === 'teacher' ? ' (teacher)' : ''}
          </span>
        ))}
      </div>
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
      <WhiteboardToolbar
        engine={engine}
        editable={editable}
        tool={tool}
        onTool={setTool}
        canClear={teacher}
        onClear={() => setConfirmation('clear')}
      />
      <div className="relative flex min-h-0 flex-1">
        <ErrorBoundary
          key={page.id}
          fallback={
            <div role="alert" className="p-4">
              This page could not be rendered. Switch pages or rejoin the class to retry.
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
      </div>
      <WhiteboardPages
        pages={snapshot.document.pages}
        activeId={page.id}
        teacher={teacher}
        busy={busy}
        onSelect={board.setPageId}
        onAdd={() => add()}
        onDuplicate={() => add(page.id)}
        onDelete={() => setConfirmation('delete')}
        onMove={() => {
          const i = snapshot.document.pages.findIndex((p) => p.id === page.id);
          if (i > 0)
            board.operate({
              id: crypto.randomUUID(),
              type: 'reorder-page',
              pageId: page.id,
              beforeId: snapshot.document.pages[i - 1].id,
            });
        }}
      />
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
                ? 'Clear this page?'
                : confirmation === 'discard'
                  ? 'Discard unsaved changes?'
                  : 'Delete this page?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation === 'discard'
                ? 'Download your unsaved work first. This restores the saved board and removes pending local changes.'
                : 'This removes the page content for everyone in this class.'}
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
                else
                  board.operate({
                    id: crypto.randomUUID(),
                    type: 'delete-page',
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
