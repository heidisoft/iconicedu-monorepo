'use client';

import { useEffect, useRef, useState } from 'react';
import { Circle, Loader2, Square } from 'lucide-react';
import { RecordingContentError } from './meeting-share-compositor';
import { RecordingStatus } from '@zoom/videosdk';
import type { MeetingFeatureAction } from './meeting-feature-action';

export type MeetingRecordingClient = {
  canStartRecording: () => boolean;
  startCloudRecording: () => Promise<'' | Error>;
  stopCloudRecording: () => Promise<'' | Error>;
  resumeCloudRecording?: () => Promise<'' | Error>;
  getCloudRecordingStatus: () => RecordingStatus;
};

export type MeetingRecordingControlProps = {
  canManage: boolean;
  enabled?: boolean;
  autoStart?: boolean;
  allowStop?: boolean;
  client: MeetingRecordingClient | null;
  status: RecordingStatus | null;
  beforeStart?: () => Promise<void>;
  onStatusChange: (status: RecordingStatus) => void;
};

export function useMeetingRecordingControl({
  canManage,
  enabled = true,
  autoStart = false,
  allowStop = true,
  client,
  status,
  onStatusChange,
  beforeStart,
}: MeetingRecordingControlProps) {
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const active =
    status === RecordingStatus.Recording || status === RecordingStatus.Paused;

  const toggleRecording = async (startOnly = false) => {
    if (!enabled || !canManage || !client || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      const current = client.getCloudRecordingStatus();
      const resume =
        current === RecordingStatus.Paused && !!client.resumeCloudRecording && !startOnly;
      const stop =
        !resume &&
        (current === RecordingStatus.Recording || current === RecordingStatus.Paused);
      if (stop && (startOnly || !allowStop)) return;
      if (!stop && !resume && !client.canStartRecording())
        throw new Error('Recording unavailable');
      if (!stop && beforeStart) await beforeStart();
      const result = await (resume
        ? client.resumeCloudRecording!()
        : stop
          ? client.stopCloudRecording()
          : client.startCloudRecording());
      if (result instanceof Error) throw result;
      onStatusChange(client.getCloudRecordingStatus());
    } catch (error) {
      setError(
        error instanceof RecordingContentError
          ? error.message
          : "Recording couldn't be changed. Check cloud recording permissions and try again.",
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const autoAttempt = useRef<MeetingRecordingClient | null>(null);
  useEffect(() => {
    if (!client) {
      autoAttempt.current = null;
      return;
    }
    if (!enabled || !autoStart || !canManage || autoAttempt.current === client) return;
    autoAttempt.current = client;
    void toggleRecording(true);
    // The attempt is tied to connection/client and policy, not recording events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, enabled, autoStart, canManage]);

  const resumable = status === RecordingStatus.Paused && !!client?.resumeCloudRecording;
  const action: MeetingFeatureAction | null =
    canManage && enabled
      ? {
          id: 'recording',
          label: pending
            ? 'Updating recording'
            : resumable
              ? 'Resume recording'
              : active
                ? allowStop
                  ? 'Stop recording'
                  : 'Recording locked'
                : 'Start recording',
          icon: pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : active ? (
            <Square />
          ) : (
            <Circle />
          ),
          active,
          disabled:
            pending ||
            !client ||
            (active && !resumable && !allowStop) ||
            (!active && !client.canStartRecording()),
          onSelect: () => void toggleRecording(),
        }
      : null;
  return {
    action,
    error,
  };
}
