import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useNativeWhiteboardFeature } from './use-native-whiteboard-feature';
import type { WhiteboardSnapshotVM } from '@iconicedu/shared-types';
import type { WhiteboardCollaborationProvider } from './collaboration/provider';
const snapshot: WhiteboardSnapshotVM = {
  id: 'board',
  revision: 1,
  role: 'student',
  presence: [],
  document: {
    schemaVersion: 1,
    studentEditing: true,
    pages: [{ id: 'one', title: 'Page 1', elements: [] }],
  },
};
function fixture(role: 'teacher' | 'student' = 'student', initial = snapshot) {
  let receive: (value: WhiteboardSnapshotVM) => void = () => {};
  const save = vi.fn().mockResolvedValue({ ...snapshot, role });
  const disconnect = vi.fn();
  const collaboration: WhiteboardCollaborationProvider = {
    refresh: vi.fn(),
    connect: (callback) => {
      receive = callback;
      callback({ ...initial, role });
      return disconnect;
    },
  };
  return {
    repository: { load: async () => snapshot, save },
    collaboration,
    disconnect,
    receive: (presenting: boolean) =>
      act(() =>
        receive({
          ...snapshot,
          role,
          presentationActive: presenting,
          document: { ...snapshot.document, presenting },
        }),
      ),
  };
}
describe('video-independent whiteboard presentation', () => {
  it('keeps the meeting view on join when only a saved presentation flag remains', () => {
    const f = fixture('teacher', {
      ...snapshot,
      presentationActive: false,
      document: { ...snapshot.document, presenting: true },
    });
    const { result } = renderHook(() =>
      useNativeWhiteboardFeature(
        { provider: 'excalidraw', token: 'capability', role: 'teacher' },
        true,
        true,
        f.repository,
        f.collaboration,
      ),
    );
    expect(result.current.open).toBe(false);
    expect(f.repository.save).not.toHaveBeenCalled();
  });
  it('opens for a live presentation on initial join and closes when its lease expires', () => {
    const f = fixture('student', { ...snapshot, presentationActive: true });
    const { result } = renderHook(() =>
      useNativeWhiteboardFeature(
        { provider: 'excalidraw', token: 'capability' },
        true,
        true,
        f.repository,
        f.collaboration,
      ),
    );
    expect(result.current.open).toBe(true);
    f.receive(false);
    expect(result.current.open).toBe(false);
  });
  it('stops presentation heartbeats when leaving the meeting', () => {
    const f = fixture('teacher', { ...snapshot, presentationActive: true });
    const { result, rerender } = renderHook(
      ({ connected }) =>
        useNativeWhiteboardFeature(
          { provider: 'excalidraw', token: 'capability', role: 'teacher' },
          true,
          connected,
          f.repository,
          f.collaboration,
        ),
      { initialProps: { connected: true } },
    );
    expect(result.current.open).toBe(true);
    rerender({ connected: false });
    expect(f.disconnect).toHaveBeenCalledTimes(1);
    expect(result.current.open).toBe(false);
  });
  it('opens for peer presentation and late joins while permitting students to hide locally', async () => {
    const f = fixture();
    const { result } = renderHook(() =>
      useNativeWhiteboardFeature(
        { provider: 'excalidraw', token: 'capability' },
        true,
        true,
        f.repository,
        f.collaboration,
      ),
    );
    f.receive(true);
    expect(result.current.open).toBe(true);
    expect(result.current.presenting).toBe(false);
    await act(() => result.current.toggle());
    expect(result.current.open).toBe(false);
    expect(f.repository.save).not.toHaveBeenCalled();
    f.receive(true);
    expect(result.current.open).toBe(false);
    f.receive(false);
    f.receive(true);
    expect(result.current.open).toBe(true);
  });
  it('authorizes teacher presentation changes through the repository and contains failures', async () => {
    const f = fixture('teacher');
    const { result } = renderHook(() =>
      useNativeWhiteboardFeature(
        { provider: 'excalidraw', token: 'capability', role: 'teacher' },
        true,
        true,
        f.repository,
        f.collaboration,
      ),
    );
    await act(() => result.current.toggle());
    expect(f.repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'presentation', enabled: true }),
    );
    expect(result.current.presenting).toBe(true);
    f.repository.save.mockRejectedValue(new Error('offline'));
    await act(() => result.current.toggle());
    expect(result.current.error).toContain('Unable to update');
    expect(result.current.open).toBe(true);
    await waitFor(() => expect(result.current.open).toBe(true));
  });
});
