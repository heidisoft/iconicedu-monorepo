'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveSessionJoinCredentialsVM } from '@iconicedu/shared-types';
import { guestJoinLiveSession } from '@iconicedu/web/lib/live-sessions/public-api';
import {
  clearLiveSessionRecovery,
  readLiveSessionRecovery,
  rememberLiveSession,
} from '@iconicedu/web/lib/live-sessions/browser-session';

export type DevicePreferences = { muted: boolean; videoOff: boolean };
type StoredJoin = {
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
}: {
  sessionId: string;
  initialCredentials?: LiveSessionJoinCredentialsVM | null;
  initialPasscode?: string | null;
  participantName?: string | null;
  accessToken?: string | null;
  identityKey?: string | null;
}) {
  const recoveryIdentity = `${initialCredentials ? 'host' : 'participant'}:${identityKey ?? 'anonymous'}`;
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
    setBusy(false);
    setError(null);
    pending.current = false;
    autoAttempted.current = false;
    const recovery = readLiveSessionRecovery<unknown>(sessionId);
    if (
      recovery &&
      isStoredJoin(recovery.payload) &&
      recovery.payload.recoveryIdentity === recoveryIdentity &&
      recovery.payload.participantName === (participantName ?? null)
    ) {
      if (!initialCredentials) {
        setCredentials(recovery.payload.credentials);
        setPasscode(recovery.payload.passcode);
      }
      setPreferences({ muted: recovery.muted, videoOff: recovery.videoOff });
    }
    setReady(true);
    return () => {
      requestGeneration.current += 1;
    };
  }, [sessionId, initialCredentials, participantName, initialPasscode, recoveryIdentity]);

  const requestJoin = useCallback(
    async (input: { displayName: string; passcode: string }) => {
      if (pending.current || !input.displayName.trim() || !input.passcode.trim()) return;
      pending.current = true;
      const generation = requestGeneration.current;
      setBusy(true);
      setError(null);
      const result = await guestJoinLiveSession(sessionId, input, accessToken);
      if (generation !== requestGeneration.current) return;
      pending.current = false;
      setBusy(false);
      if ('status' in result) {
        setError(result.message);
        return;
      }
      setCredentials(result);
      setPasscode(input.passcode);
    },
    [sessionId, accessToken],
  );

  useEffect(() => {
    if (
      !ready ||
      credentials ||
      !participantName ||
      !initialPasscode ||
      autoAttempted.current
    )
      return;
    autoAttempted.current = true;
    void requestJoin({ displayName: participantName, passcode: initialPasscode });
  }, [ready, credentials, participantName, initialPasscode, requestJoin]);

  const join = useCallback(
    (devices: DevicePreferences) => {
      if (!credentials) return;
      rememberLiveSession(sessionId, devices, {
        expiresAt: credentials.expiresAt,
        payload: {
          credentials,
          passcode,
          participantName: participantName ?? null,
          recoveryIdentity,
        } satisfies StoredJoin,
      });
      setPreferences(devices);
    },
    [sessionId, credentials, passcode, participantName, recoveryIdentity],
  );

  const leave = useCallback(() => {
    clearLiveSessionRecovery(sessionId);
  }, [sessionId]);
  return {
    ready,
    credentials,
    passcode,
    preferences,
    busy,
    error,
    requestJoin,
    join,
    leave,
  };
}
