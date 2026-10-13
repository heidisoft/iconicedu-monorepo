import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AnnotationContext,
  AnnotationOperation,
  AnnotationCommit,
  AnnotationLaserStroke,
} from '@iconicedu/shared-types';
import { nativeAnnotationApi } from '@/lib/classroom/annotation-api';
import { NativeScreenAnnotations } from './native-screen-annotations';

jest.mock('@/lib/classroom/annotation-api', () => ({ nativeAnnotationApi: jest.fn() }));
jest.mock('@iconicedu/utils', () => ({
  participantColor: () => '#000000',
  ...jest.requireActual('../../../../../packages/utils/src/annotations/state'),
}));
jest.mock('@/lib/classroom/export-image', () => ({
  exportClassroomImage: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: { text: 'black', card: 'white' } }),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));
const context: AnnotationContext = {
  actor: { userId: 'synthetic-user', name: 'Test student', role: 'student' },
  actors: [],
  snapshot: {
    schemaVersion: 1,
    roomId: 'room',
    shareSessionId: 'room',
    revision: 0,
    studentsEnabled: true,
    ended: false,
    objects: [],
  },
};
function setup(value = context) {
  let current = { ...value.snapshot, objects: [...value.snapshot.objects] };
  const api = {
    load: jest.fn(async () => ({ ...value, snapshot: current })),
    save: jest.fn(
      async (
        _room: string,
        operation: AnnotationOperation,
      ): Promise<AnnotationCommit> => {
        const objects =
          operation.kind === 'put'
            ? [{ ...operation.object, version: operation.baseVersion + 1 }]
            : operation.kind === 'delete'
              ? current.objects
                  .filter((object) => object.id === operation.id)
                  .map((object) => ({
                    ...object,
                    deleted: true,
                    version: object.version + 1,
                  }))
              : [];
        const merged = new Map(current.objects.map((object) => [object.id, object]));
        for (const object of objects) merged.set(object.id, object);
        current = {
          ...current,
          revision: current.revision + 1,
          objects: [...merged.values()],
        };
        return {
          eventId: operation.eventId,
          roomId: current.roomId,
          revision: current.revision,
          objects,
          ended: false,
          studentsEnabled: current.studentsEnabled,
        };
      },
    ),
    laser: jest.fn(async (_strokes: AnnotationLaserStroke[]) => undefined),
    pointer: jest.fn().mockResolvedValue(undefined),
  };
  jest.mocked(nativeAnnotationApi).mockReturnValue(api);
  const screen = render(
    <NativeScreenAnnotations
      sessionId="session"
      shareKey="peer"
      width={200}
      height={100}
      active
    />,
  );
  return { api, screen };
}
function stroke(screen: ReturnType<typeof render>) {
  const surface = screen.getByTestId('annotation-drawing-surface');
  fireEvent(surface, 'responderGrant', { nativeEvent: { locationX: 50, locationY: 50 } });
  fireEvent(surface, 'responderMove', { nativeEvent: { locationX: 100, locationY: 75 } });
  fireEvent(surface, 'responderRelease');
}
describe('native screen annotation delivery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  });
  it('sends vanishing strokes as ephemeral presence without persisting a drawing', async () => {
    const { api, screen } = setup();
    await waitFor(() =>
      expect(screen.getByTestId('annotation-drawing-surface').props.pointerEvents).toBe(
        'auto',
      ),
    );
    fireEvent.press(screen.getByText('Vanishing Pen'));
    stroke(screen);
    await waitFor(() => expect(api.laser).toHaveBeenCalled());
    await waitFor(() =>
      expect(api.laser.mock.calls.at(-1)?.[0]).toEqual([
        expect.objectContaining({
          finished: true,
          expiresAt: expect.any(Number),
          object: expect.objectContaining({ type: 'vanishingPen' }),
        }),
      ]),
    );
    expect(api.save).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
  it('persists normalized strokes before sending them through the API', async () => {
    const { api, screen } = setup();
    await waitFor(() =>
      expect(screen.getByTestId('annotation-drawing-surface').props.pointerEvents).toBe(
        'auto',
      ),
    );
    stroke(screen);
    await waitFor(() => expect(api.save).toHaveBeenCalled());
    expect(api.save.mock.calls[0][1]).toMatchObject({
      kind: 'put',
      object: {
        points: [
          { x: 0.25, y: 0.5 },
          { x: 0.5, y: 0.75 },
        ],
      },
    });
    expect(jest.mocked(AsyncStorage.setItem).mock.invocationCallOrder[0]).toBeLessThan(
      api.save.mock.invocationCallOrder[0],
    );
  });
  it('undoes and redoes a saved stroke through versioned provider operations', async () => {
    const { api, screen } = setup();
    await waitFor(() =>
      expect(screen.getByTestId('annotation-drawing-surface').props.pointerEvents).toBe(
        'auto',
      ),
    );
    stroke(screen);
    await waitFor(() => expect(screen.getByText('1 annotation')).toBeTruthy());
    await waitFor(() => expect(screen.queryByText('Saving annotations…')).toBeNull());
    fireEvent.press(screen.getByLabelText('Undo annotation'));
    await waitFor(() => expect(screen.getByText('0 annotations')).toBeTruthy());
    await waitFor(() => expect(screen.queryByText('Saving annotations…')).toBeNull());
    fireEvent.press(screen.getByLabelText('Redo annotation'));
    await waitFor(() => expect(screen.getByText('1 annotation')).toBeTruthy());
    expect(api.save.mock.calls.map((call) => call[1].kind)).toEqual([
      'put',
      'delete',
      'put',
    ]);
    expect(api.save.mock.calls[2][1]).toMatchObject({
      baseVersion: 2,
      object: { version: 3, deleted: false },
    });
  });
  it('selects and rotates an owned annotation with the current provider version', async () => {
    const { api, screen } = setup();
    await waitFor(() =>
      expect(screen.getByTestId('annotation-drawing-surface').props.pointerEvents).toBe(
        'auto',
      ),
    );
    stroke(screen);
    await waitFor(() => expect(screen.getByText('1 annotation')).toBeTruthy());
    await waitFor(() => expect(screen.queryByText('Saving annotations…')).toBeNull());
    fireEvent.press(screen.getByText('Select'));
    const surface = screen.getByTestId('annotation-drawing-surface');
    fireEvent(surface, 'responderGrant', {
      nativeEvent: { locationX: 75, locationY: 60 },
    });
    fireEvent(surface, 'responderRelease');
    fireEvent.press(screen.getByLabelText('Rotate selected annotation'));
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(2));
    expect(api.save.mock.calls[1][1]).toMatchObject({
      baseVersion: 1,
      object: { rotation: 15 },
    });
  });
  it('does not draw when student editing is disabled', async () => {
    const { api, screen } = setup({
      ...context,
      snapshot: { ...context.snapshot, studentsEnabled: false },
    });
    await waitFor(() => expect(api.load).toHaveBeenCalled());
    stroke(screen);
    expect(api.save).not.toHaveBeenCalled();
    expect(screen.getByTestId('annotation-drawing-surface').props.pointerEvents).toBe(
      'none',
    );
  });
  it('recovers the original operation ID after reopening a share', async () => {
    const operation = { eventId: 'recoverable-id', kind: 'clear', scope: 'mine' };
    jest
      .mocked(AsyncStorage.getItem)
      .mockResolvedValue(
        JSON.stringify({ savedAt: Date.now(), operations: [operation] }),
      );
    const { api } = setup();
    await waitFor(() => expect(api.save).toHaveBeenCalledWith('room', operation));
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      'classroom-annotations:room:synthetic-user',
    );
  });
});
