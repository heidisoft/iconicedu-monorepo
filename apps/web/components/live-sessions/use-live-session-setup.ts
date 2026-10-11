'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  LiveSessionJoinCredentialsVM,
  LiveSessionStudentOptionVM,
  LiveSessionJoinRequest,
} from '@iconicedu/shared-types';
import {
  isMeetingMediaPreferences,
  type MeetingMediaPreferences,
} from './meeting-media-preferences';
import { guestJoinLiveSession } from '@iconicedu/web/lib/live-sessions/public-api';
import {
  clearLiveSessionRecovery,
  readLiveSessionRecovery,
  rememberLiveSession,
} from '@iconicedu/web/lib/live-sessions/browser-session';

export type DevicePreferences = {
  muted: boolean;
  videoOff: boolean;
  mediaSettings?: MeetingMediaPreferences;
  cameraId?: string;
  microphoneId?: string;
};
type StoredJoin = {
  mediaSettings?: MeetingMediaPreferences;
  cameraId?: string;
  microphoneId?: string;
  credentials: LiveSessionJoinCredentialsVM;
  passcode: string | null;
  participantName: string | null;
  recoveryIdentity: string;
};

function isStoredJoin(value: unknown): value is StoredJoin {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<StoredJoin>;
  const credentials = data.credentials;
  return (
    !!credentials &&
    typeof credentials.token === 'string' &&
    !!credentials.token &&
    typeof credentials.sessionName === 'string' &&
    !!credentials.sessionName &&
    typeof credentials.displayName === 'string' &&
    (credentials.expiresAt === null || typeof credentials.expiresAt === 'string') &&
    (data.passcode === null || typeof data.passcode === 'string') &&
    (data.participantName === null || typeof data.participantName === 'string') &&
    (data.mediaSettings === undefined || isMeetingMediaPreferences(data.mediaSettings)) &&
    (data.cameraId === undefined || typeof data.cameraId === 'string') &&
    (data.microphoneId === undefined || typeof data.microphoneId === 'string') &&
    typeof data.recoveryIdentity === 'string'
  );
}

/** Coordinates setup without importing the SDK, router, or presentation components. */
export function useLiveSessionSetup({
  sessionId,
  initialCredentials,
  initialPasscode,
  participantName,
  accessToken,
  identityKey,
  students,
}: {
  sessionId: string;
  initialCredentials?: LiveSessionJoinCredentialsVM | null;
  initialPasscode?: string | null;
  participantName?: string | null;
  accessToken?: string | null;
  identityKey?: string | null;
  students?: LiveSessionStudentOptionVM[];
}) {
  const recoveryIdentity = `${initialCredentials ? 'host' : 'participant'}:${identityKey ?? 'anonymous'}`;
  const [studentProfileId, setStudentProfileId] = useState<string | null>(
    students?.length === 1 ? students[0].profileId : null,
  );
  const [credentials, setCredentials] = useState(initialCredentials ?? null);
  const [passcode, setPasscode] = useState(initialPasscode ?? null);
  const [preferences, setPreferences] = useState<DevicePreferences | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const autoAttempted = useRef(false);
  const requestGeneration = useRef(0);

  useEffect(() => {
    setCredentials(initialCredentials ?? null);
    setPasscode(initialPasscode ?? null);
    setPreferences(null);
    setStudentProfileId(students?.length === 1 ? students[0].profileId : null);
    setBusy(false);
    setError(null);
    pending.current = false;
    autoAttempted.current = false;
    const recovery = readLiveSessionRecovery<unknown>(sessionId);
    if (
      recovery &&
      isStoredJoin(recovery.payload) &&
      recovery.payload.recoveryIdentity === recoveryIdentity &&
      recovery.payload.participantName === (participantName ?? null) &&
      (students === undefined ||
        students.some(
          (student) =>
            student.profileId ===
            (recovery.payload as StoredJoin).credentials.studentProfileId,
        ))
    ) {
      if (!initialCredentials) {
        setCredentials(recovery.payload.credentials);
        setPasscode(recovery.payload.passcode);
      }
      setStudentProfileId(recovery.payload.credentials.studentProfileId ?? null);
      setPreferences({
        muted: recovery.muted,
        videoOff: recovery.videoOff,
        mediaSettings: recovery.payload.mediaSettings,
        cameraId: recovery.payload.cameraId,
        microphoneId: recovery.payload.microphoneId,
      });
    }
    setReady(true);
    return () => {
      requestGeneration.current += 1;
    };
  }, [
    sessionId,
    initialCredentials,
    participantName,
    initialPasscode,
    recoveryIdentity,
    students,
  ]);

  const requestJoin = useCallback(
    async (input: LiveSessionJoinRequest) => {
      if (
        pending.current ||
        !input.displayName.trim() ||
        (!input.passcode.trim() && !initialCredentials)
      )
        return null;
      pending.current = true;
      const generation = requestGeneration.current;
      setBusy(true);
      setError(null);
      const result = await guestJoinLiveSession(sessionId, input, accessToken);
      if (generation !== requestGeneration.current) return null;
      pending.current = false;
      setBusy(false);
      if ('status' in result) {
        setError(result.message);
        return null;
      }
      setCredentials(result);
      setPasscode(input.passcode);
      return result;
    },
    [sessionId, accessToken, initialCredentials],
  );

  useEffect(() => {
    if (
      !ready ||
      students !== undefined ||
      credentials ||
      !participantName ||
      !initialPasscode ||
      autoAttempted.current
    )
      return;
    autoAttempted.current = true;
    void requestJoin({ displayName: participantName, passcode: initialPasscode });
  }, [ready, credentials, participantName, initialPasscode, requestJoin, students]);

  const join = useCallback(
    async (devices: DevicePreferences & { displayName?: string }) => {
      let joining = credentials;
      if (students !== undefined) {
        const student = students.find((item) => item.profileId === studentProfileId);
        if (!student || !passcode) return;
        joining = await requestJoin({
          displayName: student.displayName,
          passcode,
          studentProfileId: student.profileId,
          ...(devices.displayName && devices.displayName !== student.displayName
            ? { displayNameOverride: devices.displayName }
            : {}),
        });
      }
      if (
        students === undefined &&
        joining &&
        devices.displayName &&
        devices.displayName !== joining.displayName
      ) {
        joining = await requestJoin({
          displayName: joining.displayName,
          displayNameOverride: devices.displayName,
          // Hosts may have no session passcode; the API independently rechecks host authorization.
          passcode: passcode ?? '',
        });
      }
      if (!joining) return;
      rememberLiveSession(sessionId, devices, {
        expiresAt: joining.expiresAt,
        payload: {
          credentials: joining,
          mediaSettings: devices.mediaSettings,
          cameraId: devices.cameraId,
          microphoneId: devices.microphoneId,
          passcode,
          participantName: participantName ?? null,
          recoveryIdentity,
        } satisfies StoredJoin,
      });
      setPreferences(devices);
    },
    [
      sessionId,
      credentials,
      passcode,
      participantName,
      recoveryIdentity,
      students,
      studentProfileId,
      requestJoin,
    ],
  );

  const leave = useCallback(() => {
    clearLiveSessionRecovery(sessionId);
  }, [sessionId]);
  return {
    ready,
    credentials,
    passcode,
    setPasscode,
    studentProfileId,
    setStudentProfileId,
    preferences,
    busy,
    error,
    requestJoin,
    join,
    leave,
  };
}
