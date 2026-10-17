import { act, renderHook } from '@testing-library/react-native';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useClassroomLasers } from './use-classroom-lasers';
jest.mock('@iconicedu/utils', () => ({ participantColor: () => '#008000' }));
it('renders remote laser samples once and releases disconnected pointers on expiry', () => {
  jest.useFakeTimers();
  const updateScene = jest.fn();
  const api = { updateScene } as unknown as ExcalidrawImperativeAPI;
  const { unmount } = renderHook(() => useClassroomLasers(api));
  const presence = [
    {
      actorId: 'peer',
      expiresAt: Date.now() + 100,
      samples: [{ id: 'sample', x: 100, y: 200, button: 'down' as const }],
    },
  ];
  act(() => {
    window.classroomLasers?.(presence);
    jest.advanceTimersByTime(20);
  });
  expect(updateScene.mock.calls[0][0].collaborators.get('peer')).toMatchObject({
    pointer: { x: 100, y: 200, tool: 'laser' },
    button: 'down',
  });
  const count = updateScene.mock.calls.length;
  act(() => {
    window.classroomLasers?.(presence);
    jest.advanceTimersByTime(20);
  });
  expect(updateScene).toHaveBeenCalledTimes(count);
  act(() => {
    jest.advanceTimersByTime(70);
  });
  expect(updateScene.mock.calls.at(-1)[0].collaborators.get('peer').button).toBe('up');
  act(() => {
    jest.advanceTimersByTime(80);
  });
  expect(updateScene.mock.calls.at(-1)[0].collaborators.size).toBe(0);
  unmount();
  expect(window.classroomLasers).toBeUndefined();
  jest.useRealTimers();
});
