'use client';
import { useEffect, useState } from 'react';
import { useNativeWhiteboardFeature } from './use-native-whiteboard-feature';
import { ClassroomWhiteboard } from './classroom-whiteboard';
import { Button } from '@iconicedu/ui-web/ui/button';
/** Uses the production canvas/API/transport. No fake collaboration or persistence. */
export function WhiteboardClassFixture() {
  const [entry, setEntry] = useState<{
    token: string;
    title: string;
    presentation?: boolean;
  } | null>(null);
  const [joined, setJoined] = useState(false);
  useEffect(() => {
    const value = sessionStorage.getItem('whiteboard-test-entry');
    if (value) setEntry(JSON.parse(value));
  }, []);
  if (!entry) return <p>Class access is required</p>;
  if (!joined)
    return (
      <main className="p-6">
        <h1>{entry.title}</h1>
        <Button onClick={() => setJoined(true)}>Join class whiteboard</Button>
      </main>
    );
  if (entry.presentation)
    return <WhiteboardPresentationFixture token={entry.token} title={entry.title} />;
  return (
    <main className="p-2" style={{ height: '100dvh' }}>
      <ClassroomWhiteboard token={entry.token} title={entry.title} />
    </main>
  );
}

function WhiteboardPresentationFixture({
  token,
  title,
}: {
  token: string;
  title: string;
}) {
  const board = useNativeWhiteboardFeature({ provider: 'excalidraw', token }, true, true);
  return (
    <main className="flex flex-col p-2" style={{ height: '100dvh' }}>
      <div className="flex shrink-0 gap-2 p-2">
        <h1>{title}</h1>
        {board.role === 'teacher' && (
          <Button onClick={() => void board.toggle()}>
            {board.open ? 'End class whiteboard' : 'Open class whiteboard'}
          </Button>
        )}
      </div>
      {board.error && <p role="alert">{board.error}</p>}
      <div className="min-h-0 flex-1">
        {board.open ? (
          <ClassroomWhiteboard token={token} title={title} />
        ) : (
          <p>Whiteboard is closed</p>
        )}
      </div>
    </main>
  );
}
