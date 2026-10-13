import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AnnotationContext } from '@iconicedu/shared-types';
import { nativeAnnotationApi } from '@/lib/classroom/annotation-api';
import { NativeScreenAnnotations } from './native-screen-annotations';

jest.mock('@/lib/classroom/annotation-api', () => ({ nativeAnnotationApi: jest.fn() }));
jest.mock('@iconicedu/utils', () => ({
  participantColor: () => '#000000',
  applyAnnotationCommit: (snapshot: unknown) => snapshot,
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
  const api = {
    load: jest.fn().mockResolvedValue(value),
    save: jest.fn().mockResolvedValue({}),
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
