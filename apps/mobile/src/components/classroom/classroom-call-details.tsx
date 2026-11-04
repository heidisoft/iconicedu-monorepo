import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, MessageCircle, PhoneMissed, Video } from 'lucide-react-native';
import type { ClassroomCallVM } from '@iconicedu/shared-types';
import { classroomCallsApi } from '@/lib/classroom/calls-api';
import { useTheme } from '@/providers/theme-provider';

export function ClassroomCallDetails({ callId }: { callId: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const [call, setCall] = useState<ClassroomCallVM | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(null);
    void classroomCallsApi
      .detail(callId)
      .then((value) => {
        if (active) setCall(value);
      })
      .catch(() => {
        if (active)
          setError(
            'Unable to load this call. Check your connection or classroom access.',
          );
      });
    return () => {
      active = false;
    };
  }, [callId, attempt]);
  const action = async (kind: 'join' | 'message') => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      if (kind === 'join') {
        const result = await classroomCallsApi.joinMissed(callId);
        router.push(
          `/classroom/${result.sessionId}` as Parameters<typeof router.push>[0],
        );
      } else {
        const result = await classroomCallsApi.messageTutor(callId);
        router.push(result.nativePath as Parameters<typeof router.push>[0]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to open this action.');
    } finally {
      setPending(false);
    }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(app)/(tabs)/inbox');
        }}
        style={{
          width: 48,
          height: 48,
          alignItems: 'center',
          justifyContent: 'center',
          margin: 12,
        }}
      >
        <ArrowLeft size={24} color={colors.text} />
      </Pressable>
      <View
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 440,
            padding: 24,
            borderRadius: 24,
            backgroundColor: colors.card,
            gap: 20,
          }}
        >
          <PhoneMissed size={32} color={colors.text} />
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: '600' }}>
            {call?.status === 'expired' ? 'Missed call' : 'Class call'}
          </Text>
          {call ? (
            <>
              <Text style={{ color: colors.text, fontSize: 18 }}>
                From {call.callerName}
              </Text>
              <Text style={{ color: colors.textMuted }}>{call.classTitle}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Join classroom"
                disabled={pending || !call.canJoin}
                onPress={() => {
                  void action('join');
                }}
                style={{
                  minHeight: 48,
                  borderRadius: 24,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: colors.action,
                  opacity: pending || !call.canJoin ? 0.45 : 1,
                }}
              >
                <Video size={20} color={colors.actionForeground} />
                <Text style={{ color: colors.actionForeground }}>Join classroom</Text>
              </Pressable>
              {!call.canJoin && (
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {call.joinUnavailableReason ??
                    'The class is not currently in its scheduled time.'}
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Message tutor"
                disabled={pending || !call.messageAvailable}
                onPress={() => {
                  void action('message');
                }}
                style={{
                  minHeight: 48,
                  borderRadius: 24,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: colors.actionSubtle,
                  opacity: pending || !call.messageAvailable ? 0.45 : 1,
                }}
              >
                <MessageCircle size={20} color={colors.text} />
                <Text style={{ color: colors.text }}>Message tutor</Text>
              </Pressable>
              {!call.messageAvailable && (
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  Messaging is not available for this conversation.
                </Text>
              )}
            </>
          ) : (
            !error && (
              <ActivityIndicator accessibilityLabel="Loading call" color={colors.text} />
            )
          )}
          {error && (
            <>
              <Text accessibilityRole="alert" style={{ color: colors.text }}>
                {error}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry"
                onPress={() => setAttempt((v) => v + 1)}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={{ color: colors.text }}>Retry</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
