'use client';
import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import type {
  AnnotationCommit,
  AnnotationContext,
  AnnotationOperation,
  AnnotationPreview,
  AnnotationSnapshot,
} from '@iconicedu/shared-types';
import { applyAnnotationCommit } from '@iconicedu/utils';
import { SharedContentSurface } from '@iconicedu/ui-web';
const Overlay = dynamic(
  () => import('./annotation-overlay').then((module) => module.AnnotationOverlay),
  { ssr: false },
);
const initial: AnnotationSnapshot = {
  schemaVersion: 1,
  roomId: 'fixture',
  shareSessionId: 'fixture',
  revision: 0,
  studentsEnabled: true,
  ended: false,
  objects: [],
};
function useFixtureAnnotations() {
  const [snapshot, setSnapshot] = useState(initial);
  const ref = useRef(snapshot);
  ref.current = snapshot;
  const actor = {
    userId: 'fixture-tutor',
    role: 'educator' as const,
    name: 'Fixture tutor',
  };
  const context: AnnotationContext = { actor, actors: [actor], snapshot };
  const [vanishing, setVanishing] = useState<
    { object: AnnotationSnapshot['objects'][number]; expiresAt: number }[]
  >([]);
  const execute = async (operation: AnnotationOperation): Promise<AnnotationCommit> => {
    const previous = ref.current;
    const objects =
      operation.kind === 'put'
        ? [{ ...operation.object, version: operation.baseVersion + 1 }]
        : operation.kind === 'delete'
          ? previous.objects
              .filter((object) => object.id === operation.id)
              .map((object) => ({
                ...object,
                deleted: true,
                version: object.version + 1,
              }))
          : operation.kind === 'clear'
            ? previous.objects.map((object) => ({
                ...object,
                deleted: true,
                version: object.version + 1,
              }))
            : [];
    const result: AnnotationCommit = {
      eventId: operation.eventId,
      roomId: 'fixture',
      revision: previous.revision + 1,
      objects,
      studentsEnabled:
        operation.kind === 'permissions' ? operation.enabled : previous.studentsEnabled,
      ended: false,
    };
    ref.current = applyAnnotationCommit(previous, result);
    setSnapshot(ref.current);
    return result;
  };
  return {
    context,
    objects: snapshot.objects.filter((object) => !object.deleted),
    remoteDrafts: [],
    pointers: {},
    vanishing,
    connected: true,
    canDraw: true,
    error: null,
    historyCount: { undo: 0, redo: 0 },
    broadcast: (event: AnnotationPreview) => {
      if (event.kind === 'vanish') {
        setVanishing((previous) => [
          ...previous,
          { object: event.object, expiresAt: event.expiresAt },
        ]);
        setTimeout(
          () =>
            setVanishing((previous) =>
              previous.filter((item) => item.object.id !== event.object.id),
            ),
          4000,
        );
      }
    },
    execute,
    changeHistory: async () => undefined,
    clientId: 'fixture-client',
  };
}
export function AnnotationVisualFixture() {
  const [portrait, setPortrait] = useState(false);
  const [composited, setComposited] = useState(false);
  const useAnnotations = () => {
    const engine = useFixtureAnnotations();
    return engine;
  };
  return (
    <main className="min-h-screen bg-muted p-6">
      <h1 className="text-lg font-semibold">Screen annotation browser fixture</h1>
      <button
        type="button"
        className="my-2 rounded-md bg-background p-3"
        onClick={() => setPortrait((value) => !value)}
      >
        Resize viewer
      </button>
      <label className="ml-4">
        <input
          type="checkbox"
          checked={composited}
          onChange={(event) => setComposited(event.target.checked)}
        />
        Simulate composited share
      </label>
      <div
        data-testid="annotation-viewer"
        className="relative bg-card"
        style={{
          width: portrait ? 700 : 1000,
          height: portrait ? 850 : 650,
          maxWidth: '100%',
        }}
      >
        <SharedContentSurface
          source={{ width: 1920, height: 1080 }}
          overlay={(size) => (
            <Overlay
              sourceComposited={composited}
              sessionId="fixture-session"
              shareKey="123"
              useAnnotations={useAnnotations}
              {...size}
            />
          )}
        >
          <div className="absolute inset-0 grid grid-cols-2 items-center bg-white p-12 text-black">
            <div>
              <h2 className="text-3xl">Shared lesson</h2>
              <p className="mt-4 text-xl">2x + 4 = 12</p>
            </div>
            <div className="rounded-lg border-2 border-blue-600 p-6">
              Annotate this content
            </div>
          </div>
        </SharedContentSurface>
      </div>
    </main>
  );
}
