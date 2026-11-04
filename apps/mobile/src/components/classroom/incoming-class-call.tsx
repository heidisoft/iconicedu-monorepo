import React, { useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { Alert, AppState, Modal, Pressable, Text, Vibration, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import { MessageCircle, Phone, PhoneOff } from 'lucide-react-native';
import type { ClassroomCallVM } from '@iconicedu/shared-types';
import { markActivityFeedRead } from '@/lib/api/queries';
import { useFamilyView } from '@/providers/family-view-provider';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import { classroomCallsApi } from '@/lib/classroom/calls-api';

function getNotificationsModule() {
  // Keep the native module behind the Expo Go guard, like the shared notification handler.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as typeof import('expo-notifications');
}
export function IncomingClassCall() {
  const { session } = useAuth();
  const family = useFamilyView();
  const profileId =
    typeof family.profile?.id === 'string' ? family.profile.id : undefined;
  const { colors } = useTheme();
  const router = useRouter();
  const [call, setCall] = useState<ClassroomCallVM | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<'accepted' | 'declined' | 'message' | null>(
    null,
  );
  const busy = useRef(false);
  const dismissed = useRef(new Set<string>());
  // Metro requires a static require to bundle native audio assets.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const player = useAudioPlayer(require('../../../assets/sounds/classroom-ring.wav'));
  useEffect(() => {
    if (!session?.user.id) {
      setCall(null);
      dismissed.current.clear();
      return;
    }
    let active = true;
    let loading = false;
    const refresh = async () => {
      if (loading || AppState.currentState !== 'active') return;
      loading = true;
      try {
        const calls = await classroomCallsApi.incoming();
        for (const item of calls)
          if (dismissed.current.has(item.id))
            void classroomCallsApi.respond(item.id, 'declined').catch(() => {});
        if (active)
          setCall(calls.find((item) => !dismissed.current.has(item.id)) ?? null);
        return calls;
      } catch {
        /* Keep an existing invitation only until its local expiry. */
      } finally {
        loading = false;
      }
    };
    let removeNotifications = () => {};
    if (Constants.appOwnership !== 'expo') {
      void (async () => {
        const notifications = getNotificationsModule();
        if (!active) return;
        const onResponse = async (
          response: import('expo-notifications').NotificationResponse | null,
        ) => {
          const data = response?.notification.request.content.data;
          if (
            data?.prefKey === 'classroom.call.missed' &&
            typeof data.classroomCallId === 'string'
          ) {
            await notifications.clearLastNotificationResponseAsync();
            if (
              typeof data.orgId === 'string' &&
              typeof data.activityFeedItemId === 'string' &&
              profileId
            )
              void markActivityFeedRead(data.orgId, profileId, [
                data.activityFeedItemId,
              ]).catch(() => {});
            void notifications.setBadgeCountAsync(0);
            if (active)
              router.push(
                `/classroom-call/${encodeURIComponent(data.classroomCallId)}` as Parameters<
                  typeof router.push
                >[0],
              );
            return;
          }
          if (data?.prefKey !== 'classroom.call') return;
          await notifications.clearLastNotificationResponseAsync();
          const calls = await classroomCallsApi.incoming().catch(() => null);
          if (!active) return;
          const requested = calls?.find(
            (item) =>
              !dismissed.current.has(item.id) &&
              (typeof data.classroomCallId !== 'string' ||
                item.id === data.classroomCallId),
          );
          setCall(requested ?? null);
          if (!requested && typeof data.classroomCallId === 'string')
            router.push(
              `/classroom-call/${encodeURIComponent(data.classroomCallId)}` as Parameters<
                typeof router.push
              >[0],
            );
          else if (!requested && calls?.length === 0)
            Alert.alert(
              'Call ended',
              'This class invitation is no longer ringing. You can still open the class from your classes list.',
            );
        };
        const received = notifications.addNotificationReceivedListener(() => {
          void refresh();
        });
        const responded = notifications.addNotificationResponseReceivedListener(
          (response) => {
            void onResponse(response).catch(() => {});
          },
        );
        removeNotifications = () => {
          received.remove();
          responded.remove();
        };
        await onResponse(await notifications.getLastNotificationResponseAsync());
      })().catch(() => {
        /* Polling remains available without the notification module. */
      });
    }
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 3000);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
      else setCall(null);
    });
    return () => {
      active = false;
      clearInterval(timer);
      appState.remove();
      removeNotifications();
      setCall(null);
    };
  }, [session?.user.id, profileId]);
  useEffect(() => {
    setError(null);
    if (!call) return;
    player.loop = true;
    player.play();
    Vibration.vibrate([0, 400, 1600], true);
    const timeout = setTimeout(
      () => {
        setCall(null);
        Alert.alert('Missed call', `Missed call from ${call.callerName}`, [
          { text: 'Dismiss', style: 'cancel' },
          {
            text: 'View options',
            onPress: () =>
              router.push(
                `/classroom-call/${call.id}` as Parameters<typeof router.push>[0],
              ),
          },
        ]);
      },
      Math.max(0, Date.parse(call.expiresAt) - Date.now()),
    );
    return () => {
      clearTimeout(timeout);
      player.pause();
      Vibration.cancel();
    };
  }, [call?.id, player]);
  const respond = async (action: 'accepted' | 'declined') => {
    if (!call || busy.current) return;
    busy.current = true;
    const invitation = call;
    if (action === 'declined') {
      if (dismissed.current.size >= 1000) dismissed.current.clear();
      dismissed.current.add(invitation.id);
      setCall(null);
    }
    setPending(action);
    setError(null);
    try {
      const result = await classroomCallsApi.respond(invitation.id, action);
      setCall(null);
      if (action === 'accepted')
        router.push(
          `/classroom/${result.sessionId}` as Parameters<typeof router.push>[0],
        );
    } catch (e) {
      if (action === 'accepted')
        setError(e instanceof Error ? e.message : 'Unable to answer this invitation.');
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  const message = async () => {
    if (!call || busy.current) return;
    busy.current = true;
    setPending('message');
    setError(null);
    try {
      const result = await classroomCallsApi.messageTutor(call.id);
      dismissed.current.add(call.id);
      setCall(null);
      router.push(result.nativePath as Parameters<typeof router.push>[0]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Unable to open your tutor conversation.',
      );
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  return (
    <Modal
      transparent
      visible={!!call}
      animationType="fade"
      onRequestClose={() => {
        void respond('declined');
      }}
    >
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.modalOverlay,
          padding: 24,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 380,
            padding: 28,
            borderRadius: 28,
            backgroundColor: colors.card,
            alignItems: 'center',
            gap: 16,
          }}
        >
          <Phone size={32} color={colors.text} />
          <Text style={{ color: colors.textMuted }}>Incoming class call</Text>
          <Text
            style={{
              color: colors.text,
              fontSize: 24,
              fontWeight: '600',
              textAlign: 'center',
            }}
          >
            {call?.callerName}
          </Text>
          <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
            {call?.classTitle}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            Join opens the class preview. Your camera stays under your control.
          </Text>
          {error && (
            <Text accessibilityRole="alert" style={{ color: colors.text }}>
              {error}
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 20 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decline class call"
              disabled={!!pending}
              onPress={() => {
                void respond('declined');
              }}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                borderRadius: 24,
                minWidth: 100,
                minHeight: 72,
                backgroundColor: colors.actionSubtle,
              }}
            >
              <PhoneOff size={24} color={colors.text} />
              <Text style={{ color: colors.text }}>Decline</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Join class call"
              disabled={!!pending}
              onPress={() => {
                void respond('accepted');
              }}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                borderRadius: 24,
                minWidth: 100,
                minHeight: 72,
                backgroundColor: colors.action,
              }}
            >
              <Phone size={24} color={colors.actionForeground} />
              <Text style={{ color: colors.actionForeground }}>
                {pending === 'accepted' ? 'Connecting…' : 'Join'}
              </Text>
            </Pressable>
          </View>
          {call?.messageAvailable && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Message tutor"
              disabled={!!pending}
              onPress={() => {
                void message();
              }}
              style={{
                minHeight: 44,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 12,
              }}
            >
              <MessageCircle size={20} color={colors.text} />
              <Text style={{ color: colors.text }}>
                {pending === 'message' ? 'Opening…' : 'Message tutor'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}
