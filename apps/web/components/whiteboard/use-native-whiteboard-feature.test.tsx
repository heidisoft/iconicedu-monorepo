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
function fixture(role: 'teacher' | 'student' = 'student') {
  let receive: (value: WhiteboardSnapshotVM) => void = () => {};
  const save = vi.fn().mockResolvedValue({ ...snapshot, role });
  const collaboration: WhiteboardCollaborationProvider = {
    refresh: vi.fn(),
    connect: (callback) => {
      receive = callback;
      callback({ ...snapshot, role });
      return vi.fn();
    },
  };
  return {
    repository: { load: async () => snapshot, save },
    collaboration,
    receive: (presenting: boolean) =>
      act(() =>
        receive({ ...snapshot, role, document: { ...snapshot.document, presenting } }),
      ),
  };
}
describe('video-independent whiteboard presentation', () => {
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
