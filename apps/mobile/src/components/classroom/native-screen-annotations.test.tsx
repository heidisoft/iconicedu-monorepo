import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
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
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
});
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
    expect(screen.getByLabelText('Laser pointer').props.accessibilityState.selected).toBe(
      true,
    );
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
    fireEvent.press(screen.getByLabelText('Pen'));
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
    fireEvent.press(screen.getByLabelText('Pen'));
    stroke(screen);
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText('Saving annotations…')).toBeNull());
    fireEvent.press(screen.getByLabelText('Undo annotation'));
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('Saving annotations…')).toBeNull());
    fireEvent.press(screen.getByLabelText('Redo annotation'));
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(3));
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
    fireEvent.press(screen.getByLabelText('Pen'));
    stroke(screen);
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText('Saving annotations…')).toBeNull());
    fireEvent.press(screen.getByLabelText('Select'));
    const surface = screen.getByTestId('annotation-drawing-surface');
    fireEvent(surface, 'responderGrant', {
      nativeEvent: { locationX: 75, locationY: 60 },
    });
    fireEvent(surface, 'responderRelease');
    fireEvent.press(screen.getByLabelText('More annotation actions'));
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
    expect(
      screen.getByText('The host has turned off participant annotations.'),
    ).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Pen'));
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

it('sends educator clear-all through the shared API after confirmation', async () => {
  const dialog = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const { api, screen } = setup({
    ...context,
    actor: { ...context.actor, role: 'educator' },
  });
  fireEvent.press(screen.getByLabelText('More annotation actions'));
  await waitFor(() =>
    expect(screen.getByLabelText('Clear all annotations')).toBeTruthy(),
  );
  fireEvent.press(screen.getByLabelText('Clear all annotations'));
  act(() =>
    dialog.mock.calls
      .at(-1)?.[2]
      ?.find((button) => button.text === 'Clear')
      ?.onPress?.(),
  );
  await waitFor(() =>
    expect(api.save).toHaveBeenCalledWith(
      'room',
      expect.objectContaining({ kind: 'clear', scope: 'all' }),
    ),
  );
  dialog.mockRestore();
});

it('removes annotation totals and keeps Format separate from More actions', async () => {
  const { api, screen } = setup();
  await waitFor(() =>
    expect(screen.getByTestId('annotation-drawing-surface').props.pointerEvents).toBe(
      'auto',
    ),
  );
  fireEvent.press(screen.getByLabelText('Pen'));
  stroke(screen);
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
  expect(screen.queryByText(/^\d+ annotations?$/)).toBeNull();
  fireEvent.press(screen.getByLabelText('Annotation styles'));
  expect(screen.getByLabelText('Annotation opacity')).toBeTruthy();
  expect(screen.queryByLabelText('Export annotations image')).toBeNull();
  fireEvent.press(screen.getByLabelText('More annotation actions'));
  expect(screen.getByLabelText('Export annotations image')).toBeTruthy();
  expect(screen.queryByLabelText('Annotation opacity')).toBeNull();
  fireEvent.press(screen.getByLabelText('Close annotation options'));
  expect(screen.queryByLabelText('Export annotations image')).toBeNull();
});
it('opens and closes a single launcher, stops drawing when collapsed, and reopens with the laser pointer', async () => {
  const onToggle = jest.fn();
  const screen = render(
    <NativeScreenAnnotations
      sessionId="session"
      shareKey="peer"
      width={320}
      height={220}
      active={false}
      onToggle={onToggle}
    />,
  );
  await act(async () => {});
  expect(screen.queryByLabelText('Pen')).toBeNull();
  fireEvent.press(screen.getByLabelText('Open annotation toolbar'));
  expect(onToggle).toHaveBeenCalledTimes(1);
  screen.rerender(
    <NativeScreenAnnotations
      sessionId="session"
      shareKey="peer"
      width={320}
      height={220}
      active
      onToggle={onToggle}
    />,
  );
  expect(screen.getByLabelText('Laser pointer').props.accessibilityState.selected).toBe(
    true,
  );
  fireEvent.press(screen.getByLabelText('Close annotation toolbar'));
  screen.rerender(
    <NativeScreenAnnotations
      sessionId="session"
      shareKey="peer"
      width={320}
      height={220}
      active={false}
      onToggle={onToggle}
    />,
  );
  expect(screen.getByTestId('annotation-drawing-surface').props.pointerEvents).toBe(
    'none',
  );
  expect(screen.queryByLabelText('Pen')).toBeNull();
});

it('applies staged formatting to a selection and persists the toolbar dock', async () => {
  const { api, screen } = setup();
  await waitFor(() =>
    expect(screen.getByTestId('annotation-drawing-surface').props.pointerEvents).toBe(
      'auto',
    ),
  );
  fireEvent.press(screen.getByLabelText('Pen'));
  stroke(screen);
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByText('Saving annotations…')).toBeNull());
  fireEvent.press(screen.getByLabelText('Select'));
  fireEvent(screen.getByTestId('annotation-drawing-surface'), 'responderGrant', {
    nativeEvent: { locationX: 75, locationY: 60 },
  });
  fireEvent(screen.getByTestId('annotation-drawing-surface'), 'responderRelease');
  fireEvent.press(screen.getByLabelText('Annotation styles'));
  fireEvent.changeText(screen.getByLabelText('Annotation opacity'), '50');
  expect(api.save).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByLabelText('Apply to selected'));
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(2));
  expect(api.save.mock.calls[1][1]).toMatchObject({
    kind: 'put',
    baseVersion: 1,
    object: { style: { opacity: 0.5 } },
  });
  await waitFor(() => expect(screen.queryByText('Saving annotations…')).toBeNull());
  fireEvent.press(screen.getByLabelText('More annotation actions'));
  fireEvent.press(screen.getByLabelText('Toolbar position bottom'));
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    'annotation-toolbar',
    expect.stringContaining('"dock":"bottom"'),
  );
});

it('keeps the color picker closed after drawing and toggles it from the selected tool', async () => {
  const { screen, api } = setup();
  await waitFor(() =>
    expect(screen.getByTestId('annotation-drawing-surface').props.pointerEvents).toBe(
      'auto',
    ),
  );
  fireEvent.press(screen.getByLabelText('Pen'));
  fireEvent.press(screen.getByLabelText('Close drawing styles'));
  expect(screen.queryByLabelText('Close drawing styles')).toBeNull();
  stroke(screen);
  await waitFor(() => expect(api.save).toHaveBeenCalled());
  expect(screen.queryByLabelText('Close drawing styles')).toBeNull();
  fireEvent.press(screen.getByLabelText('Pen'));
  expect(screen.getByLabelText('Close drawing styles')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Pen'));
  expect(screen.queryByLabelText('Close drawing styles')).toBeNull();
});

it('keeps save status outside toolbar flow while a stroke is being saved', async () => {
  const { api, screen } = setup();
  await waitFor(() =>
    expect(screen.getByTestId('annotation-drawing-surface').props.pointerEvents).toBe(
      'auto',
    ),
  );
  const save = api.save.getMockImplementation()!;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  api.save.mockImplementationOnce(async (...args) => {
    await pending;
    return save(...args);
  });
  fireEvent.press(screen.getByLabelText('Pen'));
  stroke(screen);
  await waitFor(() => expect(api.save).toHaveBeenCalled());
  expect(screen.getByText('Saving annotations…')).toHaveStyle({ position: 'absolute' });
  await act(async () => {
    release();
  });
  await waitFor(() => expect(screen.queryByText('Saving annotations…')).toBeNull());
});
