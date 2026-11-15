import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WhiteboardStatus } from '@zoom/videosdk';
import type { ZoomClient } from '@iconicedu/web/lib/live-sessions/zoom-session-lifecycle';
import { useZoomMessagesFeature } from './use-zoom-messages-feature';
import { useZoomWhiteboardFeature } from './use-zoom-whiteboard-feature';

function clientFixture() {
  const listeners = new Map<string, (...args: never[]) => unknown>();
  const sendToAll = vi.fn(async () => ({ id: 'sent', timestamp: 1 }));
  const board = {
    isWhiteboardEnabled: vi.fn(() => true),
    getWhiteboardPresenter: vi.fn((): { userId: number } | undefined => undefined),
    canStartWhiteboard: vi.fn(() => true),
    startWhiteboardScreen: vi.fn(async () => ''),
    startWhiteboardView: vi.fn(async () => ''),
    stopWhiteboardScreen: vi.fn(async () => ''),
    stopWhiteboardView: vi.fn(async () => ''),
    exportWhiteboard: vi.fn(async () => ''),
  };
  const client = {
    getCurrentUserInfo: () => ({ userId: 1 }),
    getChatClient: () => ({ sendToAll }),
    getWhiteboardClient: vi.fn(() => board),
    on: vi.fn((event: string, callback: (...args: never[]) => unknown) =>
      listeners.set(event, callback),
    ),
    off: vi.fn((event: string) => listeners.delete(event)),
  } as unknown as ZoomClient;
  const emit = (event: string, payload: unknown) =>
    listeners.get(event)?.(payload as never);
  return { client, board, sendToAll, emit, listeners };
}
describe('independent meeting modules', () => {
  it('subscribes to messages, tracks unread and cleans up', () => {
    const { client, emit, listeners } = clientFixture();
    const { result, rerender, unmount } = renderHook(
      ({ open }) =>
        useZoomMessagesFeature(client, { visible: true, enabled: true }, open, 'Host'),
      { initialProps: { open: false } },
    );
    act(() => {
      emit('chat-on-message', {
        message: 'Hello',
        sender: { userId: 2, name: 'Participant' },
        timestamp: 2,
      });
    });
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.messages[0].message).toBe('Hello');
    rerender({ open: true });
    expect(result.current.unreadCount).toBe(0);
    unmount();
    expect(listeners.size).toBe(0);
  });
  it('does not send while messages are read-only and preserves failed drafts', async () => {
    const { client, sendToAll } = clientFixture();
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useZoomMessagesFeature(client, { visible: true, enabled }, true, 'Host'),
      { initialProps: { enabled: false } },
    );
    act(() => result.current.setDraft('Keep this draft'));
    await act(() => result.current.send());
    expect(sendToAll).not.toHaveBeenCalled();
    rerender({ enabled: true });
    sendToAll.mockRejectedValueOnce(new Error('Offline'));
    await act(() => result.current.send());
    expect(result.current.draft).toBe('Keep this draft');
    expect(result.current.error).toContain('Try again');
    await act(() => result.current.send());
    expect(result.current.draft).toBe('');
    expect(result.current.messages[0].message).toBe('Keep this draft');
  });
  it('does not activate whiteboard SDK features when disabled', async () => {
    const { client, board } = clientFixture();
    const { result } = renderHook(() =>
      useZoomWhiteboardFeature(client, false, 'class', null),
    );
    await act(() => result.current.toggle());
    expect(client.getWhiteboardClient).not.toHaveBeenCalled();
    expect(board.startWhiteboardScreen).not.toHaveBeenCalled();
    expect(result.current.supported).toBe(false);
  });
  it('reports permission failure without claiming a whiteboard is active', async () => {
    const { client, board } = clientFixture();
    board.canStartWhiteboard.mockReturnValue(false);
    const { result, unmount } = renderHook(() =>
      useZoomWhiteboardFeature(client, true, 'class', null),
    );
    await act(() => result.current.toggle());
    expect(result.current.status).toBe(WhiteboardStatus.Closed);
    expect(result.current.presenting).toBe(false);
    expect(result.current.error).toContain('permission');
    unmount();
    expect(client.off).toHaveBeenCalledWith(
      'whiteboard-status-change',
      expect.any(Function),
    );
    expect(client.off).toHaveBeenCalledWith(
      'peer-whiteboard-state-change',
      expect.any(Function),
    );
  });
  it('recovers an existing presenter when joining late', async () => {
    const { client, board } = clientFixture();
    board.getWhiteboardPresenter.mockReturnValue({ userId: 2 });
    const { result } = renderHook(() =>
      useZoomWhiteboardFeature(client, true, 'class', null),
    );
    result.current.containerRef.current = document.createElement('div');
    await waitFor(() =>
      expect(board.startWhiteboardView).toHaveBeenCalledWith(
        result.current.containerRef.current,
        2,
      ),
    );
  });
  it('cancels a pending whiteboard view if the module disconnects', async () => {
    const { client, board } = clientFixture();
    board.getWhiteboardPresenter.mockReturnValue({ userId: 2 });
    const { result, rerender } = renderHook(
      ({ connected }) =>
        useZoomWhiteboardFeature(connected ? client : null, true, 'class', null),
      { initialProps: { connected: true } },
    );
    result.current.containerRef.current = document.createElement('div');
    rerender({ connected: false });
    await act(async () => {
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    });
    expect(board.startWhiteboardView).not.toHaveBeenCalled();
  });
});
