'use client';
import { useEffect, useState } from 'react';
import { RecordingStatus } from '@zoom/videosdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { TooltipProvider } from '@iconicedu/ui-web/ui/tooltip';
import {
  DEFAULT_LIVE_SESSION_SETTINGS,
  type LiveSessionSettingsVM,
} from '@iconicedu/shared-types';
import { MeetingFeatureSettings } from '@iconicedu/web/components/admin/meeting-feature-settings';
import { classroomMeetingSettingsApi } from '@iconicedu/web/lib/live-sessions/classroom-meeting-settings-api';
import { useMeetingRecordingControl } from './zoom-recording-control';

const auth = {
  auth: {
    getSession: async () => ({
      data: { session: { access_token: 'synthetic-test-token' } },
    }),
  },
} as unknown as SupabaseClient;
const api = classroomMeetingSettingsApi(auth);

function RecordingPreview({ policy }: { policy: LiveSessionSettingsVM['recording'] }) {
  const [status, setStatus] = useState(RecordingStatus.Stopped);
  const [client] = useState(() => {
    let sdkStatus = RecordingStatus.Stopped;
    return {
      canStartRecording: () => true,
      getCloudRecordingStatus: () => sdkStatus,
      startCloudRecording: async () => {
        sdkStatus = RecordingStatus.Recording;
        return '' as const;
      },
      stopCloudRecording: async () => {
        sdkStatus = RecordingStatus.Stopped;
        return '' as const;
      },
    };
  });
  const control = useMeetingRecordingControl({
    client,
    status,
    onStatusChange: setStatus,
    canManage: true,
    enabled: policy.enabled,
    autoStart: policy.autoStart,
    allowStop: policy.allowStop,
  });
  return (
    <>
      {control.action ? (
        <button disabled={control.action.disabled} onClick={control.action.onSelect}>
          {control.action.label}
        </button>
      ) : null}
      <output aria-label="Recording state">{status}</output>
    </>
  );
}
export function MeetingSettingsFixture() {
  const [value, setValue] = useState(structuredClone(DEFAULT_LIVE_SESSION_SETTINGS));
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<LiveSessionSettingsVM | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void api.get('fixture', 'class').then((response) => {
      setEnabled(response.enabled);
      setValue(response.settings);
      setReady(true);
    });
  }, []);
  return (
    <TooltipProvider>
      <main data-ready={ready} className="space-y-6 p-8">
        {enabled ? (
          <>
            <MeetingFeatureSettings value={value} onChange={setValue} />
            <button
              onClick={() => {
                void api
                  .save({
                    orgId: 'org',
                    profileId: 'manager',
                    classroomId: 'class',
                    settings: value,
                  })
                  .then((response) => {
                    setPreview(response.settings);
                    setError(null);
                  })
                  .catch(() => setError('Options could not be saved. Try again.'));
              }}
            >
              Save meeting options
            </button>
          </>
        ) : (
          <p>Meeting options are disabled</p>
        )}
        {error ? <p role="alert">{error}</p> : null}
        {preview ? (
          <section aria-label="Saved meeting preview">
            <RecordingPreview policy={preview.recording} />
            {preview.whiteboard.enabled ? <button>Start whiteboard</button> : null}
            {preview.invite.enabled ? <button>Share meeting</button> : null}
            {preview.participants.visible ? <button>Participants</button> : null}
            {preview.messages.visible ? (
              <section aria-label="Messages">
                <p>In-call messages</p>
                {preview.messages.enabled ? (
                  <input aria-label="Send message" />
                ) : (
                  <p>Sending messages is disabled for this meeting.</p>
                )}
              </section>
            ) : null}
          </section>
        ) : null}
      </main>
    </TooltipProvider>
  );
}
