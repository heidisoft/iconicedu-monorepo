import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text } from 'react-native';
import type {
  LiveSessionJoinCredentialsVM,
  LiveSessionStudentOptionVM,
  MeetingAdmissionVM,
} from '@iconicedu/shared-types';
import { router } from 'expo-router';
import { classroomApi } from '@/lib/classroom/api';
import { useTheme } from '@/providers/theme-provider';
import { NativeClassroom } from './native-classroom';

export function NativeClassroomEntry({ sessionId }: { sessionId: string }) {
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
  const [admissionToken, setAdmissionToken] = useState<string | undefined>();
  const [selected, setSelected] = useState<string | undefined>();
  const load = useCallback(
    async (studentProfileId?: string, admissionToken?: string) => {
      setLoading(true);
      setError(null);
      try {
        const info = await classroomApi.info(sessionId);
        if (!info.exists || !info.isActive)
          throw new Error('This meeting is no longer active.');
        setCanonicalId(info.sessionId ?? sessionId);
        if (info.isHost) {
          setHostEligible(true);
          setCredentials(info.hostJoin);
          return;
        }
        if (!info.participant)
          throw new Error('Sign in to join this classroom from the app.');
        if ((info.participant.students?.length ?? 0) > 1 && !studentProfileId) {
          setStudents(info.participant.students ?? []);
          return;
        }
        const result = await classroomApi.join(info.sessionId ?? sessionId, {
          displayName: info.participant.displayName,
          passcode: '',
          studentProfileId,
          admissionToken,
        });
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
    [sessionId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!admission || admission.status !== 'waiting') return;
    let active = true;
    const timer = setInterval(() => {
      void classroomApi
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
  }, [admission, canonicalId, selected, load]);
  if (credentials)
    return (
      <NativeClassroom
        sessionId={canonicalId}
        credentials={credentials}
        hostEligible={hostEligible}
        onRejoin={() => {
          setCredentials(null);
          void load(selected, admissionToken);
        }}
        authorize={async (displayNameOverride) => {
          const result = await classroomApi.join(canonicalId, {
            displayName: credentials.displayName,
            displayNameOverride,
            passcode: '',
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
    <ScrollView
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
      {!loading && error && !admission && (
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
            void classroomApi
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
  );
}
