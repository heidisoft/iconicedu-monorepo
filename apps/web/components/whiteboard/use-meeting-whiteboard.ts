'use client';
import { useRef } from 'react';
import { WhiteboardStatus } from '@zoom/videosdk';
import type { WhiteboardAccessVM } from '@iconicedu/shared-types';
import type { ZoomClient } from '@iconicedu/web/lib/live-sessions/zoom-session-lifecycle';
import { useNativeWhiteboardFeature } from './use-native-whiteboard-feature';
import { useZoomWhiteboardFeature } from '../live-sessions/zoom-video/use-zoom-whiteboard-feature';

/** Provider selection stays at the meeting boundary; the application board never imports Zoom. */
export function useMeetingWhiteboard(
  client: ZoomClient | null,
  enabled: boolean,
  sessionName: string,
  shareUserId: number | null,
  access?: WhiteboardAccessVM,
) {
  const native = access?.provider === 'excalidraw';
  const zoom = useZoomWhiteboardFeature(
    client,
    enabled && !native,
    sessionName,
    shareUserId,
  );
  const nativeBoard = useNativeWhiteboardFeature(
    access,
    enabled && native,
    Boolean(client),
  );
  const containerRef = useRef<HTMLDivElement>(null);
  return native
    ? {
        containerRef,
        status: nativeBoard.open ? WhiteboardStatus.InProgress : WhiteboardStatus.Closed,
        presenting: nativeBoard.presenting,
        supported: enabled,
        error: nativeBoard.error,
        dismissError: nativeBoard.dismissError,
        toggle: nativeBoard.toggle,
        exportPdf: async () => {},
        nativeToken: access?.token,
      }
    : { ...zoom, nativeToken: undefined };
}
