'use client';
import { useEffect, useState } from 'react';
import { RecordingStatus } from '@zoom/videosdk';
import type { LiveSessionSettingsVM } from '@iconicedu/shared-types';
import type { ZoomClient } from '@iconicedu/web/lib/live-sessions/zoom-session-lifecycle';
import { useMeetingRecordingControl } from './zoom-recording-control';

/** Recording owns SDK subscriptions, state, auto-start, stop policy and errors. */
export function useZoomRecordingFeature(
  client: ZoomClient | null,
  isHost: boolean,
  policy: LiveSessionSettingsVM['recording'],
) {
  const [showBanner, setShowBanner] = useState(false);
  const [status, setStatus] = useState<RecordingStatus | null>(null);
  useEffect(() => {
    if (!client) {
      setStatus(null);
      return;
    }
    setStatus(client.getRecordingClient().getCloudRecordingStatus());
    client.on('recording-change', setStatus);
    return () => client.off('recording-change', setStatus);
  }, [client]);
  useEffect(() => {
    if (status !== RecordingStatus.Recording) {
      setShowBanner(false);
      return;
    }
    setShowBanner(true);
    const timeout = setTimeout(() => setShowBanner(false), 5000);
    return () => clearTimeout(timeout);
  }, [status]);
  const control = useMeetingRecordingControl({
    client: client?.getRecordingClient() ?? null,
    canManage: isHost,
    enabled: policy.enabled,
    autoStart: policy.autoStart,
    allowStop: policy.allowStop,
    status,
    onStatusChange: setStatus,
  });
  return { status, showBanner, dismissBanner: () => setShowBanner(false), ...control };
}
