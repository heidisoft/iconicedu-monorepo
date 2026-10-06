import { AnnotationToolType, WhiteboardStatus } from '@zoom/videosdk';
import { isZoomExecutedFailure } from './zoom-session-lifecycle';

/** Zoom commands can resolve failure objects instead of rejecting their promises. */
export async function executeZoomCollaborationCommand(
  command: () => unknown | Promise<unknown>,
) {
  const result = await command();
  if (result instanceof Error || isZoomExecutedFailure(result)) throw result;
  return result;
}

type AnnotationStream = {
  canDoAnnotation: () => boolean;
  startAnnotation: () => unknown | Promise<unknown>;
  stopAnnotation: () => unknown | Promise<unknown>;
  getAnnotationController: () => {
    setToolType: (tool: AnnotationToolType) => unknown | Promise<unknown>;
  };
};

/** Local sharing need not emit an active-share event for the presenter. */
export function hasZoomAnnotationShare(
  activeShareUserId: number | null,
  isSharingScreen: boolean,
) {
  return activeShareUserId !== null || isSharingScreen;
}

export async function setZoomAnnotationEnabled(
  stream: AnnotationStream,
  enabled: boolean,
) {
  if (!enabled) {
    await executeZoomCollaborationCommand(() => stream.stopAnnotation());
    return;
  }
  if (!stream.canDoAnnotation()) {
    throw new Error(
      'Annotation is unavailable for this shared screen. Ask the presenter to allow annotation and check that annotation is enabled for the Zoom account.',
    );
  }
  await executeZoomCollaborationCommand(() => stream.startAnnotation());
  try {
    await executeZoomCollaborationCommand(() =>
      stream.getAnnotationController().setToolType(AnnotationToolType.Pen),
    );
  } catch (error) {
    // Undo a partial start so the pencil never claims drawing is active when it is not.
    await executeZoomCollaborationCommand(() => stream.stopAnnotation()).catch(
      () => undefined,
    );
    throw error;
  }
}

/** The embedded Zoom board can reject after its start command has resolved. */
export function observeZoomWhiteboardCredentialFailure(
  target: Window,
  isActive: () => boolean,
  onFailure: (error: Error) => void,
) {
  const handleFailure = (event: Event) => {
    const reason =
      event instanceof ErrorEvent
        ? (event.error ?? event.message)
        : (event as PromiseRejectionEvent).reason;
    const message = reason instanceof Error ? reason.message : reason;
    if (
      !isActive() ||
      typeof message !== 'string' ||
      !/^get confId or mmrToken failed$/i.test(message.trim())
    )
      return;
    // This known provider failure is handled by the meeting notice.
    event.preventDefault();
    onFailure(new Error(message));
  };
  target.addEventListener('error', handleFailure);
  target.addEventListener('unhandledrejection', handleFailure);
  return () => {
    target.removeEventListener('error', handleFailure);
    target.removeEventListener('unhandledrejection', handleFailure);
  };
}

/** A resolved start command does not mean the embedded board has finished loading. */
export function isZoomWhiteboardPresenting(
  status: WhiteboardStatus,
  presenterUserId: number | undefined,
  selfUserId: number | null,
) {
  return (
    status === WhiteboardStatus.InProgress &&
    selfUserId !== null &&
    presenterUserId === selfUserId
  );
}

/** Caption visibility is local; only hosts can change session-wide caption access. */
export async function enableZoomLiveCaptions(
  client: {
    startLiveTranscription: () => unknown | Promise<unknown>;
    disableCaptions: (disabled: boolean) => unknown | Promise<unknown>;
  },
  isHost: boolean,
) {
  await executeZoomCollaborationCommand(() => client.startLiveTranscription());
  if (isHost) {
    await executeZoomCollaborationCommand(() => client.disableCaptions(false));
  }
}
