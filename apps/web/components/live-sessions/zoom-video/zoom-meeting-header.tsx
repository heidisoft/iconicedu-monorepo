'use client';

import type { RecordingStatus } from '@zoom/videosdk';

import { ZoomMeetingIdentity } from './zoom-meeting-identity';
import { ZoomRecordingIndicator } from './zoom-recording-indicator';

export function ZoomMeetingHeader({
  title,
  participantCount,
  recordingStatus,
}: {
  title: string;
  participantCount: number;
  recordingStatus: RecordingStatus | null;
}) {
  return (
    <>
      <header className="zoom-meeting-header zoom-meeting-gutter-position absolute z-20 flex h-9 items-center justify-between gap-3">
        <ZoomMeetingIdentity title={title} participantCount={participantCount} />
        <ZoomRecordingIndicator status={recordingStatus} />
      </header>
    </>
  );
}
