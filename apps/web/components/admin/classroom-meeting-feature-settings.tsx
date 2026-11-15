'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import type { ChannelLiveSessionConfigVM } from '@iconicedu/shared-types';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { classroomMeetingSettingsApi } from '@iconicedu/web/lib/live-sessions/classroom-meeting-settings-api';
import { MeetingFeatureSettings } from './meeting-feature-settings';

export function ClassroomMeetingFeatureSettings({
  classroomId,
  value,
  onChange,
}: {
  classroomId?: string;
  value: ChannelLiveSessionConfigVM;
  onChange: (config: ChannelLiveSessionConfigVM) => void;
}) {
  const params = useParams<{ orgSlug: string }>();
  const [enabled, setEnabled] = useState(false);
  const [whiteboardProviderAvailable, setWhiteboardProviderAvailable] = useState(false);
  const [error, setError] = useState(false);
  const current = useRef({ value, onChange });
  current.current = { value, onChange };
  useEffect(() => {
    let cancelled = false;
    setEnabled(false);
    setError(false);
    if (!params.orgSlug) return;
    void classroomMeetingSettingsApi(createSupabaseBrowserClient())
      .get(params.orgSlug, classroomId)
      .then((response) => {
        if (cancelled) return;
        setEnabled(response.enabled);
        setWhiteboardProviderAvailable(response.whiteboardProviderAvailable === true);
        if (response.enabled)
          current.current.onChange({
            ...current.current.value,
            settings: response.settings,
          });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [params.orgSlug, classroomId]);
  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        Meeting options could not be loaded. Reload before changing them.
      </p>
    );
  if (!enabled || value.provider !== 'zoom' || !value.settings) return null;
  return (
    <MeetingFeatureSettings
      value={value.settings}
      whiteboardProviderAvailable={whiteboardProviderAvailable}
      disabled={!value.enabled}
      onChange={(settings) => onChange({ ...value, settings })}
    />
  );
}
