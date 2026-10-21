'use client';

// flag-exempt: completes the existing guardian preview selection for a shared family device.

import { formatMeetingStudentNames } from '@iconicedu/utils';
import { Alert, AlertTitle, AlertDescription } from '@iconicedu/ui-web/ui/alert';
import { Button } from '@iconicedu/ui-web/ui/button';
import { useRouter } from 'next/navigation';
import type { ComponentType, ComponentProps } from 'react';
import type {
  LiveSessionJoinCredentialsVM,
  LiveSessionSettingsVM,
  LiveSessionStudentOptionVM,
} from '@iconicedu/shared-types';
import { getLiveSessionReturnPath } from '@iconicedu/web/lib/live-sessions/navigation';
import { DevicePreviewStep } from './device-preview-step';
import { LiveSessionJoinForm } from './live-session-join-form';
import { ZoomMeetingRenderer } from './zoom-meeting-renderer';
import { ZoomSessionLoadingScreen } from './zoom-video/zoom-session-loading-screen';
import { useLiveSessionSetup } from './use-live-session-setup';

export type LiveSessionMeetingProps = ComponentProps<typeof ZoomMeetingRenderer>;
export type LiveSessionMeetingRenderer = ComponentType<LiveSessionMeetingProps>;

/** Public /live composition root. All meeting navigation stays outside the SDK renderer.
 * Inject a renderer in tests to exercise the complete flow without Zoom or real credentials.
 */
export function LiveSessionSetup({
  sessionId,
  sessionTitle,
  sharePath,
  initialCredentials,
  initialPasscode,
  participantName,
  accessToken,
  identityKey,
  settings,
  students,
  passcodeRequired = true,
  linkToken,
  returnPath = '/',
  MeetingRenderer = ZoomMeetingRenderer,
}: {
  passcodeRequired?: boolean;
  linkToken?: string;
  sessionId: string;
  sessionTitle: string;
  sharePath?: string;
  initialCredentials?: LiveSessionJoinCredentialsVM | null;
  initialPasscode?: string | null;
  participantName?: string | null;
  accessToken?: string | null;
  identityKey?: string | null;
  settings?: LiveSessionSettingsVM;
  students?: LiveSessionStudentOptionVM[];
  returnPath?: string;
  MeetingRenderer?: LiveSessionMeetingRenderer;
}) {
  const router = useRouter();
  const setup = useLiveSessionSetup({
    sessionId,
    initialCredentials,
    initialPasscode,
    participantName,
    accessToken,
    identityKey,
    students,
    passcodeRequired,
    linkToken,
  });
  if (!setup.ready) return <ZoomSessionLoadingScreen label="Restoring session…" />;
  if (setup.waiting)
    return (
      <DevicePreviewStep
        onBack={() => {
          setup.leave();
          router.replace(getLiveSessionReturnPath(returnPath));
        }}
        displayName={participantName ?? 'Guest'}
        sessionTitle={sessionTitle}
        onJoin={setup.join}
        joinDisabled
        error={setup.error}
      >
        <Alert>
          <AlertTitle>Waiting for approval</AlertTitle>
          <AlertDescription>
            A teacher or staff member will let you in. You can check your camera and
            microphone while you wait.
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          onClick={() => {
            setup.leave();
            router.replace(getLiveSessionReturnPath(returnPath));
          }}
        >
          Cancel request
        </Button>
      </DevicePreviewStep>
    );
  if (students !== undefined && !setup.preferences) {
    const selected = students.filter((student) =>
      setup.studentProfileIds.includes(student.profileId),
    );
    return (
      <DevicePreviewStep
        onBack={() => {
          setup.leave();
          router.replace(getLiveSessionReturnPath(returnPath));
        }}
        displayName={
          selected.length
            ? formatMeetingStudentNames(selected.map((student) => student.displayName))
            : 'Choose students'
        }
        sessionTitle={sessionTitle}
        onJoin={setup.join}
        busy={setup.busy}
        error={setup.error}
        joinDisabled={!selected.length || (passcodeRequired && !setup.passcode?.trim())}
      >
        {students.length === 0 ? (
          <p role="alert" className="text-sm text-muted-foreground">
            None of your linked students are enrolled in this class. Please contact the
            teacher.
          </p>
        ) : students.length > 1 ? (
          <fieldset className="w-full space-y-2" disabled={setup.busy}>
            <legend className="mb-2 text-sm font-medium">Who is joining?</legend>
            <p className="text-sm text-muted-foreground">
              Select one or more students sharing this device.
            </p>
            {students.map((student) => (
              <label
                key={student.profileId}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent"
              >
                <input
                  type="checkbox"
                  name="joining-students"
                  value={student.profileId}
                  checked={setup.studentProfileIds.includes(student.profileId)}
                  onChange={() => setup.toggleStudent(student.profileId)}
                  className="accent-primary"
                />
                {student.displayName}
              </label>
            ))}
          </fieldset>
        ) : null}
        {passcodeRequired && (!initialPasscode || setup.error) && (
          <label className="w-full space-y-2 text-sm font-medium">
            Session passcode
            <input
              type="password"
              autoComplete="off"
              value={setup.passcode ?? ''}
              disabled={setup.busy}
              onChange={(event) => setup.setPasscode(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3"
            />
          </label>
        )}
      </DevicePreviewStep>
    );
  }
  if (!setup.credentials)
    return (
      <LiveSessionJoinForm
        sessionTitle={sessionTitle}
        participantName={participantName}
        initialPasscode={initialPasscode}
        passcodeRequired={passcodeRequired}
        busy={setup.busy}
        error={setup.error}
        onSubmit={setup.requestJoin}
      />
    );
  if (!setup.preferences)
    return (
      <DevicePreviewStep
        onBack={() => {
          setup.leave();
          router.replace(getLiveSessionReturnPath(returnPath));
        }}
        displayName={setup.credentials.displayName}
        sessionTitle={sessionTitle}
        onJoin={setup.join}
        busy={setup.busy}
        error={setup.error}
      />
    );
  return (
    <div className="flex min-h-screen flex-col gap-4 px-4 py-4">
      <MeetingRenderer
        sessionName={setup.credentials.sessionName}
        token={setup.credentials.token}
        displayName={setup.credentials.displayName}
        sessionTitle={sessionTitle}
        settings={setup.credentials.settings ?? settings}
        annotationToken={setup.credentials.annotationToken}
        whiteboardAccess={setup.credentials.whiteboard}
        liveSessionId={sessionId}
        sessionPasscode={setup.passcode}
        sharePath={setup.credentials.sharePath ?? sharePath}
        accessToken={accessToken}
        meetingLinkToken={linkToken}
        initialMuted={setup.preferences.muted}
        initialVideoOff={setup.preferences.videoOff}
        initialMediaSettings={setup.preferences.mediaSettings}
        initialCameraId={setup.preferences.cameraId}
        initialMicrophoneId={setup.preferences.microphoneId}
        onLeave={() => {
          setup.leave();
          router.replace(getLiveSessionReturnPath(returnPath));
        }}
      />
    </div>
  );
}
