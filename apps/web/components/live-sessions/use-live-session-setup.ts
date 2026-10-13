'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  LiveSessionJoinCredentialsVM,
  LiveSessionStudentOptionVM,
  LiveSessionJoinRequest,
  MeetingAdmissionVM,
} from '@iconicedu/shared-types';
import {
  isMeetingMediaPreferences,
  type MeetingMediaPreferences,
} from './meeting-media-preferences';
import { createPublicApiClient } from '@iconicedu/web/lib/api/http-client';
import {
  clearMeetingLink,
  newRedemptionKey,
} from '@iconicedu/web/lib/live-sessions/link-recovery';
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
  passcodeRequired = true,
  linkToken,
}: {
  passcodeRequired?: boolean;
  linkToken?: string;
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
  const admissionKey = `iconicedu:admission:${sessionId}`;
  const [waiting, setWaiting] = useState<MeetingAdmissionVM | null>(null);
  const admissionToken = useRef<string | null>(null);
  const waitingInput = useRef<LiveSessionJoinRequest | null>(null);
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
    setWaiting(null);
    waitingInput.current = null;
    admissionToken.current = null;
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
    try {
      const saved = JSON.parse(sessionStorage.getItem(admissionKey) ?? 'null');
      if (
        saved?.recoveryIdentity === recoveryIdentity &&
        /^[\w-]{32}$/.test(saved.input?.admissionToken) &&
        typeof saved.input?.displayName === 'string'
      ) {
        waitingInput.current = saved.input;
        admissionToken.current = saved.input.admissionToken;
        setWaiting({ token: saved.input.admissionToken, status: 'waiting' });
      }
    } catch {
      /* Storage is optional. */
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
    admissionKey,
    students,
  ]);

  const requestJoin = useCallback(
    async (input: LiveSessionJoinRequest) => {
      if (
        pending.current ||
        !input.displayName.trim() ||
        (passcodeRequired && !input.passcode.trim() && !initialCredentials)
      )
        return null;
      pending.current = true;
      const generation = requestGeneration.current;
      setBusy(true);
      setError(null);
      admissionToken.current ??= newRedemptionKey();
      const joinInput = { ...input, admissionToken: admissionToken.current };
      const result = await guestJoinLiveSession(
        sessionId,
        { ...joinInput, ...(linkToken ? { linkToken } : {}) },
        accessToken,
      );
      if (generation !== requestGeneration.current) return null;
      pending.current = false;
      setBusy(false);
      if ('admission' in result && result.admission) {
        waitingInput.current = joinInput;
        setWaiting(result.admission);
        try {
          sessionStorage.setItem(
            admissionKey,
            JSON.stringify({ input: joinInput, recoveryIdentity }),
          );
        } catch {
          /* Optional recovery. */
        }
        return null;
      }
      if ('status' in result) {
        setError(result.message);
        return null;
      }
      if (!('token' in result)) return null;
      setWaiting(null);
      try {
        sessionStorage.removeItem(admissionKey);
      } catch {
        /* Storage is optional. */
      }
      setCredentials(result);
      setPasscode(result.meetingPasscode ?? input.passcode);
      return result;
    },
    [
      sessionId,
      accessToken,
      initialCredentials,
      passcodeRequired,
      linkToken,
      students,
      admissionKey,
      recoveryIdentity,
    ],
  );

  useEffect(() => {
    if (
      !ready ||
      students !== undefined ||
      credentials ||
      !participantName ||
      (passcodeRequired && !initialPasscode) ||
      autoAttempted.current
    )
      return;
    autoAttempted.current = true;
    void requestJoin({ displayName: participantName, passcode: initialPasscode ?? '' });
  }, [
    ready,
    credentials,
    participantName,
    initialPasscode,
    requestJoin,
    students,
    passcodeRequired,
  ]);

  useEffect(() => {
    if (!waiting) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await createPublicApiClient(accessToken).post<MeetingAdmissionVM>(
          `/live-sessions/${encodeURIComponent(sessionId)}/admission-status`,
          { token: waiting.token },
        );
        if (!active) return;
        if (result.status === 'approved' && waitingInput.current) {
          const joined = await requestJoin(waitingInput.current);
          if (joined) return;
        }
        if (result.status === 'denied' || result.status === 'ended') {
          setWaiting(null);
          try {
            sessionStorage.removeItem(admissionKey);
          } catch {
            /* Optional storage. */
          }
          setError(
            result.status === 'ended'
              ? 'Session has ended'
              : 'Your request to join was declined or expired',
          );
          return;
        }
        setError(null);
      } catch {
        if (active) setError('Connection interrupted. Retrying your request…');
      }
      if (active) timer = setTimeout(() => void poll(), 3000);
    };
    timer = setTimeout(() => void poll(), 1000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [waiting, sessionId, accessToken, requestJoin, admissionKey]);

  const join = useCallback(
    async (devices: DevicePreferences & { displayName?: string }) => {
      let joining = credentials;
      if (students !== undefined) {
        const student = students.find((item) => item.profileId === studentProfileId);
        if (!student || (passcodeRequired && !passcode)) return;
        joining = await requestJoin({
          displayName: student.displayName,
          passcode: passcode ?? '',
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
      passcodeRequired,
    ],
  );

  const leave = useCallback(() => {
    if (waiting)
      void createPublicApiClient(accessToken)
        .post(`/live-sessions/${encodeURIComponent(sessionId)}/admission-status`, {
          token: waiting.token,
          cancel: true,
        })
        .catch(() => undefined);
    clearLiveSessionRecovery(sessionId);
    clearMeetingLink(sessionId);
    try {
      sessionStorage.removeItem(admissionKey);
    } catch {
      /* Storage is optional. */
    }
  }, [sessionId, admissionKey, waiting, accessToken]);
  return {
    ready,
    waiting,
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
