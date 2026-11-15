import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMeetingFeedback } from './use-meeting-feedback';
import {
  rememberLiveSession,
  readLiveSessionRecovery,
} from '@iconicedu/web/lib/live-sessions/browser-session';
import { submitLiveSessionFeedback } from '@iconicedu/web/lib/live-sessions/public-api';

vi.mock('@iconicedu/web/lib/live-sessions/public-api', () => ({
  submitLiveSessionFeedback: vi.fn().mockResolvedValue({}),
}));
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('meeting feedback lifecycle', () => {
  it('clears rejoin recovery and waits for feedback before navigating', async () => {
    rememberLiveSession('class', { muted: true, videoOff: true });
    const onLeave = vi.fn();
    const { result } = renderHook(() =>
      useMeetingFeedback({ liveSessionId: 'class', displayName: 'Guest', onLeave }),
    );
    act(() => result.current.beginFeedback());
    expect(result.current.showFeedbackPrompt).toBe(true);
    expect(readLiveSessionRecovery('class')).toBeNull();
    expect(onLeave).not.toHaveBeenCalled();
    act(() => result.current.setFeedbackRating(5));
    await act(async () => {
      await result.current.submitFeedback();
    });
    expect(submitLiveSessionFeedback).toHaveBeenCalledWith(
      'class',
      { rating: 5, displayName: 'Guest' },
      undefined,
    );
    expect(onLeave).toHaveBeenCalledOnce();
    expect(result.current.hasLeft).toBe(true);
    act(() => {
      result.current.beginFeedback();
      result.current.finishLeaving();
    });
    expect(result.current.showFeedbackPrompt).toBe(false);
    expect(onLeave).toHaveBeenCalledOnce();
  });
  it('exits fullscreen and allows skipping even if the fullscreen exit is rejected', () => {
    const onLeave = vi.fn();
    const owner = {
      fullscreenElement: {},
      exitFullscreen: vi.fn().mockRejectedValue(new Error('closed')),
    };
    const { result } = renderHook(() =>
      useMeetingFeedback({ liveSessionId: 'class', displayName: 'Teacher', onLeave }),
    );
    act(() => result.current.beginFeedback(owner as unknown as Document));
    expect(owner.exitFullscreen).toHaveBeenCalledOnce();
    expect(result.current.showFeedbackPrompt).toBe(true);
    act(() => result.current.finishLeaving());
    expect(submitLiveSessionFeedback).not.toHaveBeenCalled();
    expect(onLeave).toHaveBeenCalledOnce();
  });
  it('deduplicates submissions and navigation when skip races with a pending request', async () => {
    let complete!: () => void;
    vi.mocked(submitLiveSessionFeedback).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = () => resolve({ success: true });
        }),
    );
    const onLeave = vi.fn();
    const { result } = renderHook(() =>
      useMeetingFeedback({ liveSessionId: 'class', displayName: 'Member', onLeave }),
    );
    act(() => {
      result.current.beginFeedback();
      result.current.setFeedbackRating(4);
    });
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.submitFeedback();
      void result.current.submitFeedback();
    });
    expect(submitLiveSessionFeedback).toHaveBeenCalledOnce();
    act(() => result.current.finishLeaving());
    await act(async () => {
      complete();
      await pending;
    });
    expect(onLeave).toHaveBeenCalledOnce();
  });
  it('still returns to the join source if feedback cannot be saved', async () => {
    vi.mocked(submitLiveSessionFeedback).mockRejectedValueOnce(new Error('offline'));
    const onLeave = vi.fn();
    const { result } = renderHook(() =>
      useMeetingFeedback({ liveSessionId: 'class', displayName: 'Member', onLeave }),
    );
    act(() => {
      result.current.beginFeedback();
      result.current.setFeedbackRating(3);
    });
    await act(async () => {
      await result.current.submitFeedback();
    });
    await waitFor(() => expect(onLeave).toHaveBeenCalledOnce());
  });
});
