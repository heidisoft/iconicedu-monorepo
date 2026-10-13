import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  LiveSessionJoinCredentialsVM,
  LiveSessionStudentOptionVM,
  MeetingAdmissionVM,
} from '@iconicedu/shared-types';
import { ApiHttpError } from '@/lib/api/http-error';
import { router } from 'expo-router';
import {
  readNativeMeetingLink,
  writeNativeMeetingLink,
} from '@/lib/classroom/link-recovery';
import { classroomApi } from '@/lib/classroom/api';
import { useTheme } from '@/providers/theme-provider';
import { NativeClassroom } from './native-classroom';

export function NativeClassroomEntry({
  sessionId,
  api = classroomApi,
  meetingProps,
}: {
  sessionId: string;
  api?: typeof classroomApi;
  meetingProps?: Pick<
    React.ComponentProps<typeof NativeClassroom>,
    'adapterOverride' | 'whiteboardRepository'
  >;
}) {
  const { colors } = useTheme();
  const [hostEligible, setHostEligible] = useState(false);
  const [canonicalId, setCanonicalId] = useState(sessionId);
  const [credentials, setCredentials] = useState<LiveSessionJoinCredentialsVM | null>(
    null,
  );
  const [students, setStudents] = useState<LiveSessionStudentOptionVM[]>([]);
  const [admission, setAdmission] = useState<MeetingAdmissionVM | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestForm, setGuestForm] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPasscode, setGuestPasscode] = useState('');
  const [passcodeRequired, setPasscodeRequired] = useState(false);
  const link = useRef<string | undefined>(undefined);
  const guest = useRef<{ displayName: string; passcode: string } | null>(null);

  const [admissionToken, setAdmissionToken] = useState<string | undefined>();
  const [selected, setSelected] = useState<string | undefined>();
  const load = useCallback(
    async (studentProfileId?: string, admissionToken?: string) => {
      setLoading(true);
      setError(null);
      try {
        const recovery = await readNativeMeetingLink(sessionId).catch(() => null);
        let resolved: Awaited<ReturnType<typeof api.linkInfo>> | null = null;
        if (recovery?.token) {
          try {
            resolved = await api.linkInfo(sessionId, recovery.token);
          } catch (cause) {
            if (
              cause instanceof ApiHttpError &&
              [400, 401, 403, 404, 410].includes(cause.status)
            )
              await writeNativeMeetingLink(sessionId, {
                displayName: recovery.displayName,
                expiresAt: recovery.expiresAt,
              }).catch(() => {});
            throw cause;
          }
        }
        const info = resolved?.info ?? (await api.info(sessionId));
        link.current = resolved?.linkToken;
        if (!info.exists || !info.isActive)
          throw new Error('This meeting is no longer active.');
        setCanonicalId(info.sessionId ?? sessionId);
        if (info.isHost) {
          guest.current = null;
          setGuestPasscode('');
          setHostEligible(true);
          setCredentials(info.hostJoin);
          return;
        }
        if (info.participant) {
          guest.current = null;
          setGuestPasscode('');
        }
        if (!info.participant && !guest.current) {
          const requiresPasscode = info.passcodeRequired !== false && !link.current;
          setPasscodeRequired(requiresPasscode);
          setGuestName(recovery?.displayName ?? '');
          if (recovery?.displayName && !requiresPasscode)
            guest.current = { displayName: recovery.displayName, passcode: '' };
          else {
            setGuestForm(true);
            return;
          }
        }
        if ((info.participant?.students?.length ?? 0) > 1 && !studentProfileId) {
          setStudents(info.participant?.students ?? []);
          return;
        }
        const result = await api.join(info.sessionId ?? sessionId, {
          displayName: info.participant?.displayName ?? guest.current!.displayName,
          passcode: info.participant ? '' : guest.current!.passcode,
          ...(link.current ? { linkToken: link.current } : {}),
          studentProfileId,
          admissionToken,
        });
        setGuestForm(false);
        if (!info.participant && guest.current)
          await writeNativeMeetingLink(sessionId, {
            token: link.current,
            displayName: guest.current.displayName,
            expiresAt: recovery?.expiresAt ?? Date.now() + 86400000,
          }).catch(() => {});
        if ('admission' in result) {
          setAdmission(result.admission);
          setAdmissionToken(result.admission.token);
        } else {
          setAdmission(null);
          if (result.studentProfileId) setSelected(result.studentProfileId);
          setCredentials(result);
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to load the meeting.');
      } finally {
        setLoading(false);
      }
    },
    [sessionId, api],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!admission || admission.status !== 'waiting') return;
    let active = true;
    const timer = setInterval(() => {
      void api
        .admission(canonicalId, admission.token)
        .then((status) => {
          if (!active) return;
          setError(null);
          if (status.status === 'approved') {
            clearInterval(timer);
            void load(selected, status.token);
          } else if (status.status !== 'waiting') {
            clearInterval(timer);
            setAdmission(status);
          }
        })
        .catch(() => {
          if (active) setError('Waiting room connection interrupted. Retrying…');
        });
    }, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [admission, canonicalId, selected, load, api]);
  if (credentials)
    return (
      <NativeClassroom
        {...meetingProps}
        meetingApi={api}
        sessionId={canonicalId}
        credentials={credentials}
        hostEligible={hostEligible}
        onRejoin={() => {
          setCredentials(null);
          void load(selected, admissionToken);
        }}
        authorize={async (displayNameOverride) => {
          const result = await api.join(canonicalId, {
            displayName: credentials.displayName,
            displayNameOverride,
            passcode: guest.current?.passcode ?? '',
            ...(link.current ? { linkToken: link.current } : {}),
            studentProfileId: selected,
            admissionToken,
          });
          if ('admission' in result) {
            setCredentials(null);
            setAdmission(result.admission);
            setAdmissionToken(result.admission.token);
            throw new Error('Waiting for teacher approval');
          }
          return result;
        }}
      />
    );
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: 24,
          backgroundColor: colors.bg,
        }}
      >
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 24 }}>
          Join classroom
        </Text>
        {loading && <ActivityIndicator accessibilityLabel="Loading meeting" />}
        {error && (
          <Text accessibilityRole="alert" style={{ color: colors.text }}>
            {error}
          </Text>
        )}
        {guestForm && !admission && (
          <View style={{ gap: 12, paddingVertical: 16 }}>
            <TextInput
              accessibilityLabel="Guest name"
              value={guestName}
              onChangeText={setGuestName}
              editable={!loading}
              autoComplete="name"
              maxLength={100}
              placeholder="Your name"
              style={{
                color: colors.text,
                padding: 12,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
              }}
            />
            {passcodeRequired && (
              <TextInput
                accessibilityLabel="Session passcode"
                value={guestPasscode}
                onChangeText={setGuestPasscode}
                editable={!loading}
                autoComplete={Platform.OS === 'android' ? 'off' : undefined}
                textContentType={Platform.OS === 'ios' ? 'none' : undefined}
                importantForAutofill="no"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Session passcode"
                style={{
                  color: colors.text,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                }}
              />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue to preview"
              disabled={loading || !guestName.trim()}
              onPress={() => {
                Keyboard.dismiss();
                guest.current = {
                  displayName: guestName.trim(),
                  passcode: guestPasscode,
                };
                void load(selected, admissionToken);
              }}
              style={{
                padding: 12,
                minHeight: 48,
                borderRadius: 24,
                backgroundColor: colors.action,
                opacity: loading || !guestName.trim() ? 0.5 : 1,
              }}
            >
              <Text style={{ color: colors.actionForeground, textAlign: 'center' }}>
                Continue to preview
              </Text>
            </Pressable>
          </View>
        )}
        {admission && (
          <Text style={{ color: colors.text }}>
            {admission.status === 'waiting'
              ? 'Waiting for the teacher to admit you'
              : admission.status === 'denied'
                ? 'Your request to join was declined.'
                : 'The meeting has ended.'}
          </Text>
        )}
        {!admission &&
          students.map((student) => (
            <Pressable
              accessibilityRole="button"
              key={student.profileId}
              onPress={() => {
                setSelected(student.profileId);
                void load(student.profileId);
              }}
              style={{ padding: 16 }}
            >
              <Text style={{ color: colors.text }}>{student.displayName}</Text>
            </Pressable>
          ))}
        {!loading && error && !admission && !guestForm && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void load(selected);
            }}
            style={{ padding: 16 }}
          >
            <Text style={{ color: colors.text }}>Retry</Text>
          </Pressable>
        )}
        {admission?.status === 'waiting' && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void api
                .admission(canonicalId, admission.token, true)
                .then(setAdmission)
                .catch(() => setError('Unable to cancel. Please retry.'));
            }}
            style={{ padding: 16 }}
          >
            <Text style={{ color: colors.text }}>Cancel request</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{ padding: 16 }}
        >
          <Text style={{ color: colors.text }}>Close</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
