import { AnnotationToolType, WhiteboardStatus } from '@zoom/videosdk';
import { describe, expect, it, vi } from 'vitest';
import {
  executeZoomCollaborationCommand,
  enableZoomLiveCaptions,
  observeZoomWhiteboardCredentialFailure,
  isZoomWhiteboardPresenting,
  setZoomAnnotationEnabled,
  hasZoomAnnotationShare,
} from './zoom-collaboration';

function createStream() {
  const setToolType = vi.fn().mockResolvedValue('');
  return {
    canDoAnnotation: vi.fn(() => true),
    startAnnotation: vi.fn().mockResolvedValue(''),
    stopAnnotation: vi.fn().mockResolvedValue(''),
    getAnnotationController: () => ({ setToolType }),
  };
}

describe('annotation share lifecycle', () => {
  it('keeps presenter annotation active without an active-share event', () => {
    expect(hasZoomAnnotationShare(null, true)).toBe(true);
    // Ending that local share releases annotation when no remote share remains.
    expect(hasZoomAnnotationShare(null, false)).toBe(false);
  });
  it('keeps annotation active on a remote share after local sharing ends', () => {
    expect(hasZoomAnnotationShare(42, false)).toBe(true);
  });
});

describe('Zoom collaboration commands', () => {
  it.each([
    'startWhiteboardScreen',
    'startWhiteboardView',
    'stopWhiteboardScreen',
    'stopWhiteboardView',
  ])('surfaces resolved %s failures instead of treating them as successful', async () => {
    const failure = { type: 'INSUFFICIENT_PRIVILEGES', reason: 'Whiteboard disabled' };
    await expect(executeZoomCollaborationCommand(async () => failure)).rejects.toEqual(
      failure,
    );
  });
  it('accepts successful whiteboard document IDs and propagates thrown errors', async () => {
    await expect(
      executeZoomCollaborationCommand(async () => 'document-id'),
    ).resolves.toBe('document-id');
    await expect(
      executeZoomCollaborationCommand(async () => {
        throw new Error('Unavailable');
      }),
    ).rejects.toThrow('Unavailable');
  });
  it('starts annotation with a working default pen without custom tool controls', async () => {
    const stream = createStream();
    await setZoomAnnotationEnabled(stream, true);
    expect(stream.startAnnotation).toHaveBeenCalledOnce();
    expect(stream.getAnnotationController().setToolType).toHaveBeenCalledWith(
      AnnotationToolType.Pen,
    );
  });
  it('does not select a tool when annotation fails to start', async () => {
    const stream = createStream();
    const failure = { type: 'INVALID_OPERATION', reason: 'No active sharing' };
    stream.startAnnotation.mockResolvedValue(failure);
    await expect(setZoomAnnotationEnabled(stream, true)).rejects.toEqual(failure);
    expect(stream.getAnnotationController().setToolType).not.toHaveBeenCalled();
  });
  it('stops a partial annotation session if pen setup fails', async () => {
    const stream = createStream();
    const failure = { type: 'INVALID_PARAMETERS', reason: 'Tool unavailable' };
    stream.getAnnotationController().setToolType.mockResolvedValue(failure);
    await expect(setZoomAnnotationEnabled(stream, true)).rejects.toEqual(failure);
    expect(stream.stopAnnotation).toHaveBeenCalledOnce();
  });
  it('preserves stop failures and checks permission before starting', async () => {
    const stream = createStream();
    stream.canDoAnnotation.mockReturnValue(false);
    await expect(setZoomAnnotationEnabled(stream, true)).rejects.toThrow(
      'Annotation is unavailable',
    );
    expect(stream.startAnnotation).not.toHaveBeenCalled();
    const failure = { type: 'INVALID_OPERATION', reason: 'Stop failed' };
    stream.stopAnnotation.mockResolvedValue(failure);
    await expect(setZoomAnnotationEnabled(stream, false)).rejects.toEqual(failure);
  });
});

describe('delayed whiteboard credential failures', () => {
  it('handles a runtime rejection after startup and removes listeners on cleanup', () => {
    const failure = vi.fn();
    const cleanup = observeZoomWhiteboardCredentialFailure(window, () => true, failure);
    const event = new Event('unhandledrejection', { cancelable: true });
    Object.defineProperty(event, 'reason', {
      value: new Error('get confId or mmrToken failed'),
    });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(failure).toHaveBeenCalledOnce();
    cleanup();
    window.dispatchEvent(event);
    expect(failure).toHaveBeenCalledOnce();
  });
  it('leaves unrelated errors and failures outside an active board untouched', () => {
    let active = false;
    const failure = vi.fn();
    const cleanup = observeZoomWhiteboardCredentialFailure(window, () => active, failure);
    const credentialError = new ErrorEvent('error', {
      message: 'get confId or mmrToken failed',
      cancelable: true,
    });
    window.dispatchEvent(credentialError);
    expect(credentialError.defaultPrevented).toBe(false);
    active = true;
    const unrelated = new ErrorEvent('error', {
      message: 'Other application error',
      cancelable: true,
    });
    window.dispatchEvent(unrelated);
    expect(unrelated.defaultPrevented).toBe(false);
    expect(failure).not.toHaveBeenCalled();
    window.dispatchEvent(credentialError);
    expect(failure).toHaveBeenCalledOnce();
    cleanup();
  });
});

describe('whiteboard presentation readiness', () => {
  it('keeps pending and closed boards out of the presenting state', () => {
    expect(isZoomWhiteboardPresenting(WhiteboardStatus.Pending, 42, 42)).toBe(false);
    expect(isZoomWhiteboardPresenting(WhiteboardStatus.Closed, 42, 42)).toBe(false);
  });
  it('marks only the current presenter of a ready board as presenting', () => {
    expect(isZoomWhiteboardPresenting(WhiteboardStatus.InProgress, 42, 42)).toBe(true);
    expect(isZoomWhiteboardPresenting(WhiteboardStatus.InProgress, 12, 42)).toBe(false);
    expect(isZoomWhiteboardPresenting(WhiteboardStatus.InProgress, undefined, null)).toBe(
      false,
    );
  });
});

describe('Video SDK live caption access', () => {
  it('lets participants request transcription without using a host-only command', async () => {
    const client = {
      startLiveTranscription: vi.fn().mockResolvedValue(''),
      disableCaptions: vi.fn().mockResolvedValue(''),
    };
    await enableZoomLiveCaptions(client, false);
    expect(client.startLiveTranscription).toHaveBeenCalledOnce();
    expect(client.disableCaptions).not.toHaveBeenCalled();
  });
  it('lets hosts enable session captions after transcription starts', async () => {
    const client = {
      startLiveTranscription: vi.fn().mockResolvedValue(''),
      disableCaptions: vi.fn().mockResolvedValue(''),
    };
    await enableZoomLiveCaptions(client, true);
    expect(client.disableCaptions).toHaveBeenCalledWith(false);
    expect(client.startLiveTranscription.mock.invocationCallOrder[0]).toBeLessThan(
      client.disableCaptions.mock.invocationCallOrder[0],
    );
  });
  it('propagates resolved transcription and caption access failures', async () => {
    const failure = { type: 'INSUFFICIENT_PRIVILEGES', reason: 'Captions disabled' };
    const client = {
      startLiveTranscription: vi.fn().mockResolvedValue(failure),
      disableCaptions: vi.fn().mockResolvedValue(''),
    };
    await expect(enableZoomLiveCaptions(client, true)).rejects.toEqual(failure);
    expect(client.disableCaptions).not.toHaveBeenCalled();
    client.startLiveTranscription.mockResolvedValue('');
    client.disableCaptions.mockResolvedValue(failure);
    await expect(enableZoomLiveCaptions(client, true)).rejects.toEqual(failure);
  });
});
