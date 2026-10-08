'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { SharedContentSurface } from '@iconicedu/ui-web';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { useScreenAnnotations } from './use-screen-annotations';
const Overlay = dynamic(
  () => import('./annotation-overlay').then((module) => module.AnnotationOverlay),
  { ssr: false },
);
function SharedScreen({ sessionId }: { sessionId: string }) {
  const engine = useScreenAnnotations(sessionId, '123');
  return (
    <>
      <output aria-label="Live preview marks">{engine.remoteDrafts.length}</output>
      <output aria-label="Synchronized marks">{engine.objects.length}</output>
      <output aria-label="Annotation connection">
        {engine.connected ? 'Connected' : 'Connecting'}
      </output>
      <div
        style={{ height: 440, width: '100%', maxWidth: 800 }}
        className="border border-border bg-card"
      >
        <SharedContentSurface
          source={{ width: 1600, height: 900 }}
          overlay={(size) => (
            <Overlay
              sessionId={sessionId}
              shareKey="123"
              {...size}
              useAnnotations={() => engine}
            />
          )}
        >
          <div className="absolute inset-0 p-8">Shared lesson</div>
        </SharedContentSurface>
      </div>
    </>
  );
}
export function CollaborativeAnnotationFixture() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [error, setError] = useState('');
  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <button
        onClick={() =>
          void (async () => {
            const entry = JSON.parse(
              sessionStorage.getItem('annotation-test-entry') ?? '{}',
            ) as { email: string; password: string; sessionId: string };
            const result = await createSupabaseBrowserClient().auth.signInWithPassword({
              email: entry.email,
              password: entry.password,
            });
            if (result.error) setError('Test sign-in failed');
            else setSessionId(entry.sessionId);
          })()
        }
      >
        Join annotation test
      </button>
      {error && <p role="alert">{error}</p>}
      <button onClick={() => setVisible((previous) => !previous)}>
        {visible ? 'Hide shared screen' : 'Show shared screen'}
      </button>
      {sessionId && visible && <SharedScreen sessionId={sessionId} />}
    </main>
  );
}
