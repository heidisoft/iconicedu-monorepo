import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  Alert,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { EventType, useZoom, WhiteboardView } from '@zoom/react-native-videosdk';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  LiveSessionJoinCredentialsVM,
  MeetingWaitingParticipantVM,
} from '@iconicedu/shared-types';
import {
  NativeMeetingController,
  type NativeLeaveReason,
  type NativeMeetingAdapter,
  type NativeShareMode,
} from '@/lib/classroom/meeting-controller';
import { createZoomNativeAdapter } from '@/lib/classroom/zoom-native-adapter';
import { classroomApi } from '@/lib/classroom/api';
import { useTheme } from '@/providers/theme-provider';
import { useNativePictureInPicture } from './use-native-picture-in-picture';
import { useNativeMediaDevices } from './use-native-media-devices';
import { NativeFocusedVideo } from './native-focused-video';
import { NativeDevicePreview } from './native-device-preview';
import { NativeClassroomSettings } from './native-classroom-settings';
import { NativeMeetingToolbar } from './native-meeting-toolbar';
import { NativeVideoView } from './native-video-view';
import { NativeShareStage } from './native-share-stage';
import { NativeWhiteboard, type NativeWhiteboardRepository } from './native-whiteboard';

const LEAVE_TITLES: Record<NativeLeaveReason, string> = {
  self: 'You left the classroom',
  'ended-by-host': 'The host ended the class',
  removed: 'You were removed from the class',
  network: 'You were disconnected from the class',
  unknown: 'The class connection closed',
};
// Same choices and copy as the web settings panel.
const SHARE_MODES: Array<[NativeShareMode, string]> = [
  ['locked', 'Only the host can share'],
  ['multiple', 'Multiple participants can share simultaneously'],
  ['single', 'One participant can share at a time'],
];

export function NativeClassroom({
  sessionId,
  title,
  credentials: initialCredentials,
  hostEligible = false,
  adapterOverride,
  whiteboardRepository,
  authorize,
  onRejoin,
  meetingApi = classroomApi,
}: {
  sessionId: string;
  /** The class title shown to people; `credentials.sessionName` is Zoom's session key. */
  title?: string;
  credentials: LiveSessionJoinCredentialsVM;
  hostEligible?: boolean;
  adapterOverride?: NativeMeetingAdapter;
  whiteboardRepository?: NativeWhiteboardRepository;
  meetingApi?: Pick<
    typeof classroomApi,
    'waiting' | 'admit' | 'audit' | 'quality' | 'feedback'
  >;
  onRejoin?: () => void;
  authorize?: (displayNameOverride?: string) => Promise<LiveSessionJoinCredentialsVM>;
}) {
  const [credentials, setCredentials] = useState(initialCredentials);
  const zoom = useZoom();
  const [adapter] = useState(() => adapterOverride ?? createZoomNativeAdapter(zoom));
  const [controller] = useState(
    () => new NativeMeetingController(adapter, initialCredentials),
  );
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const pageSize = 4;
  const pageCount = Math.max(1, Math.ceil(state.participants.length / pageSize));
  const gridUsers = state.participants.slice(
    Math.min(page, pageCount - 1) * pageSize,
    (Math.min(page, pageCount - 1) + 1) * pageSize,
  );
  const [cameraPermission, requestCamera] = useCameraPermissions();
  const [micPermission, requestMic] = useMicrophonePermissions();
  const [panel, setPanel] = useState<
    'none' | 'audio' | 'participants' | 'chat' | 'whiteboard'
  >('none');
  const [settingsTab, setSettingsTab] = useState<'audio' | 'video'>('audio');
  const mediaDevices = useNativeMediaDevices(adapter, panel === 'audio');
  const [boardPending, setBoardPending] = useState(false);
  const [focused, setFocused] = useState<{ id: string; sharing: boolean } | null>(null);
  const pip = useNativePictureInPicture(
    adapter.pictureInPicture,
    state,
    focused?.id,
    boardPending || panel === 'whiteboard',
  );
  const [zoomBoardActive, setZoomBoardActive] = useState(false);
  useEffect(() => {
    if (state.phase !== 'meeting' || credentials.whiteboard?.provider === 'excalidraw')
      return;
    let active = true;
    const update = async () => {
      try {
        const sharing = await zoom.whiteboardHelper.isOtherSharingWhiteboard();
        const canStop = await zoom.whiteboardHelper.canStopShareWhiteboard();
        if (!active) return;
        setZoomBoardActive(sharing || canStop);
        if (sharing || canStop) setPanel('whiteboard');
      } catch {
        /* A reconnect will refresh the sharing state. */
      }
    };
    const subscription = zoom.addListener(
      EventType.onUserWhiteboardShareStatusChanged,
      () => {
        void update();
      },
    );
    void update();
    return () => {
      active = false;
      subscription.remove();
    };
  }, [state.phase, credentials.whiteboard?.provider, zoom]);
  const onBoardPresentation = useCallback(
    (active: boolean) =>
      setPanel((previous) =>
        active ? 'whiteboard' : previous === 'whiteboard' ? 'none' : previous,
      ),
    [],
  );
  const [annotating, setAnnotating] = useState(false);
  const [captions, setCaptions] = useState(false);
  const [displayName, setDisplayName] = useState(credentials.displayName);
  const [text, setText] = useState('');
  const [lastReadMessage, setLastReadMessage] = useState<string | null>(null);
  useEffect(() => {
    if (panel === 'chat' && state.messages.length)
      setLastReadMessage(state.messages.at(-1)!.id);
  }, [panel, state.messages]);
  const unreadMessages =
    panel === 'chat'
      ? 0
      : state.messages.length -
        (state.messages.findIndex((message) => message.id === lastReadMessage) + 1);
  useEffect(() => {
    if (state.phase === 'ended') {
      setPanel('none');
      setFocused(null);
    }
  }, [state.phase]);

  const [error, setError] = useState<string | null>(null);
  const [originalAudio, setOriginalAudio] = useState(false);
  const [mirrored, setMirrored] = useState(false);
  useEffect(() => {
    if (panel === 'audio' && adapter.devices) setMirrored(mediaDevices.devices.mirrored);
  }, [adapter, panel, mediaDevices.devices.mirrored]);
  const [micTest, setMicTest] = useState(false);
  const [speakerTest, setSpeakerTest] = useState(false);
  const [volume, setVolume] = useState(0);
  const autoRecordingAttempted = useRef(false);
  const recordingReported = useRef(false);
  const [waiting, setWaiting] = useState<MeetingWaitingParticipantVM[]>([]);
  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to complete this action. Please retry.',
      );
    }
  };
  const moderator = controller.self?.host || controller.self?.cohost;
  const selfSharing = !!state.selfId && state.sharingUserIds.includes(state.selfId);
  const isHost = !!controller.self?.host;
  useEffect(() => {
    if (isHost && state.phase === 'meeting')
      void controller.refreshShareMode().catch(() => {});
  }, [controller, isHost, state.phase]);
  useEffect(
    () => () => {
      void controller.dispose();
    },
    [controller],
  );
  useEffect(() => {
    if (panel !== 'audio') return;
    const subscription = zoom.addListener(
      EventType.onMicSpeakerVolumeChanged,
      (value: unknown) => {
        if (
          value &&
          typeof value === 'object' &&
          'micVolume' in value &&
          typeof value.micVolume === 'number'
        )
          setVolume(Math.min(100, Math.max(0, value.micVolume)));
      },
    );
    return () => subscription.remove();
  }, [zoom, panel]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && state.phase === 'meeting' && Platform.OS === 'ios')
        void zoom
          .isInSession()
          .then((inSession) =>
            inSession ? zoom.audioHelper.resetAudioSession() : undefined,
          )
          .catch(() =>
            setError('Check your audio output after returning to the meeting.'),
          );
    });
    return () => subscription.remove();
  }, [zoom.audioHelper, zoom.isInSession, state.phase]);
  useEffect(() => {
    if (!moderator || !['meeting', 'reconnecting'].includes(state.phase)) return;
    let active = true;
    const refresh = () => {
      void meetingApi
        .waiting(sessionId)
        .then((value) => {
          if (active) setWaiting(value);
        })
        .catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [moderator, sessionId, state.phase, meetingApi]);
  useEffect(() => {
    if (
      state.phase !== 'meeting' ||
      !controller.self?.host ||
      !controller.settings.recording.enabled ||
      !controller.settings.recording.autoStart ||
      autoRecordingAttempted.current
    )
      return;
    autoRecordingAttempted.current = true;
    void controller
      .recording(true)
      .catch(() =>
        setError('Automatic recording could not start. Use Start recording to retry.'),
      );
  }, [controller, state.phase, state.participants]);
  useEffect(() => {
    if (state.recording && !recordingReported.current && controller.self?.host)
      void meetingApi.audit(sessionId, 'recording_started').catch(() => {});
    recordingReported.current = state.recording;
  }, [state.recording, state.participants, controller, sessionId, meetingApi]);
  useEffect(() => {
    if (state.phase !== 'meeting' && state.phase !== 'reconnecting') return;
    void meetingApi
      .quality(
        sessionId,
        'connection_state',
        state.phase === 'meeting' ? 'Connected' : 'Reconnecting',
        credentials.displayName,
      )
      .catch(() => {});
  }, [state.phase, sessionId, credentials.displayName, meetingApi]);
  useEffect(() => {
    if (state.network)
      void meetingApi
        .quality(sessionId, 'network_quality', state.network, credentials.displayName)
        .catch(() => {});
  }, [state.network, sessionId, credentials.displayName, meetingApi]);
  const button = (label: string, action: () => void, disabled = false) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={action}
      style={{
        minHeight: 44,
        padding: 12,
        borderRadius: 12,
        backgroundColor: colors.actionSubtle,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: colors.text }}>{label}</Text>
    </Pressable>
  );
  const join = () =>
    run(async () => {
      if (state.camera && !(cameraPermission?.granted || (await requestCamera()).granted))
        throw new Error('Camera permission is required, or turn your camera off.');
      if (state.microphone && !(micPermission?.granted || (await requestMic()).granted))
        throw new Error('Microphone permission is required, or join muted.');
      await adapter.prepareAudio?.();
      await adapter.stopAudioTests();
      setMicTest(false);
      setSpeakerTest(false);
      const fresh = authorize
        ? await authorize(
            displayName !== credentials.displayName ? displayName : undefined,
          )
        : credentials;
      setCredentials(fresh);
      await controller.join(fresh);
    });
  if (Platform.OS === 'android' && pip.active)
    return (
      <View
        testID="classroom-picture-in-picture"
        style={{ flex: 1, backgroundColor: colors.bg }}
      >
        {state.phase === 'ended' ? (
          <Text style={{ color: colors.text }}>Class ended</Text>
        ) : (
          <>
            {pip.target?.user.video || pip.target?.sharing ? (
              <NativeVideoView
                userId={pip.target.user.id}
                sharing={pip.target.sharing}
                style={{ flex: 1 }}
              />
            ) : null}
            <Text style={{ color: colors.text, padding: 8 }}>
              {pip.target?.user.name ?? 'Classroom'}
            </Text>
          </>
        )}
      </View>
    );
  const preview = state.phase === 'preview' || state.phase === 'joining';
  return (
    <>
      <NativeFocusedVideo
        user={state.participants.find((user) => user.id === focused?.id)}
        sharing={focused?.sharing ?? false}
        onClose={() => setFocused(null)}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            automaticallyAdjustKeyboardInsets={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          >
            <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 24 }}>
              {preview
                ? 'Ready to join?'
                : state.phase === 'ended'
                  ? LEAVE_TITLES[state.leaveReason ?? 'self']
                  : (title ?? credentials.sessionName)}
            </Text>
            {(error || state.error) && (
              <Text accessibilityRole="alert" style={{ color: colors.text }}>
                {error ?? state.error}
              </Text>
            )}
            {state.phase === 'reconnecting' && (
              <Text accessibilityRole="alert" style={{ color: colors.text }}>
                Reconnecting to the classroom…
              </Text>
            )}
            {captions && state.caption && (
              <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>
                {state.caption}
              </Text>
            )}
            {state.reactions.length > 0 && (
              <Text style={{ color: colors.text }}>
                {state.reactions.map((reaction) => reaction.emoji).join(' ')}
              </Text>
            )}
            {state.network && (
              <Text style={{ color: colors.text }}>Connection: {state.network}</Text>
            )}
            {state.recording && (
              <Text
                accessibilityLabel={
                  state.recordingPaused ? 'Recording paused' : 'Recording active'
                }
                style={{ color: colors.text }}
              >
                {state.recordingPaused ? '❚❚ Recording paused' : '● Recording'}
              </Text>
            )}
            {state.recordingConsent && (
              <View
                accessibilityRole="alert"
                style={{
                  gap: 8,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.card,
                }}
              >
                <Text style={{ color: colors.text }}>
                  {state.recordingConsent === 'traditional'
                    ? 'This class is being recorded. Stay to consent to the recording, or leave the class.'
                    : 'The host wants to record you. You can stay in the class either way.'}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {button(
                    state.recordingConsent === 'traditional'
                      ? 'Stay and consent'
                      : 'Allow recording',
                    () => {
                      void run(() => controller.respondToRecordingConsent(true));
                    },
                  )}
                  {button(
                    state.recordingConsent === 'traditional'
                      ? 'Leave class'
                      : "Don't record me",
                    () => {
                      void run(() => controller.respondToRecordingConsent(false));
                    },
                  )}
                </View>
              </View>
            )}
            {preview ? (
              <NativeDevicePreview
                displayName={displayName}
                sessionName={title ?? credentials.sessionName}
                camera={state.camera}
                microphone={state.microphone}
                joining={state.phase === 'joining'}
                onDisplayName={setDisplayName}
                onCamera={() => {
                  controller.setPreview({ camera: !state.camera });
                  if (!state.camera && !cameraPermission?.granted) void requestCamera();
                }}
                onMicrophone={() =>
                  controller.setPreview({ microphone: !state.microphone })
                }
                onSettings={() => {
                  setSettingsTab('audio');
                  setPanel('audio');
                }}
                onTest={() => {
                  setSettingsTab('audio');
                  setPanel('audio');
                }}
                onJoin={() => {
                  void join();
                }}
              >
                <View
                  style={{
                    height: width >= 700 ? 350 : 240,
                    borderRadius: 16,
                    overflow: 'hidden',
                    backgroundColor: colors.card,
                  }}
                >
                  {state.phase === 'preview' &&
                  state.camera &&
                  cameraPermission?.granted ? (
                    <NativeVideoView preview userId={null} style={{ flex: 1 }} />
                  ) : (
                    <Text style={{ color: colors.text, padding: 24 }}>
                      {state.camera
                        ? 'Allow camera access to see your preview.'
                        : 'Camera is off'}
                    </Text>
                  )}
                </View>
                {state.camera &&
                  !cameraPermission?.granted &&
                  button('Allow camera access', () => {
                    void requestCamera();
                  })}
              </NativeDevicePreview>
            ) : state.phase === 'ended' ? (
              <>
                <Text style={{ color: colors.text }}>How was your class?</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map((rating) =>
                    button(`${rating} stars`, () => {
                      void run(() =>
                        meetingApi
                          .feedback(sessionId, rating, credentials.displayName)
                          .then(() => router.back()),
                      );
                    }),
                  )}
                </View>
                {onRejoin && button('Rejoin classroom', onRejoin)}
                {button('Close classroom', () => router.back())}
              </>
            ) : (
              <>
                {state.sharingUserId &&
                  state.sharingUserId !== state.selfId &&
                  focused?.id !== state.sharingUserId && (
                    <NativeShareStage
                      sessionId={sessionId}
                      userId={state.sharingUserId}
                      token={credentials.annotationToken}
                      height={width >= 700 ? 420 : 250}
                      annotating={annotating}
                      composited={state.composited.includes(state.sharingUserId)}
                    />
                  )}
                {state.sharingUserId && state.sharingUserId === state.selfId && (
                  <Text style={{ color: colors.text }}>You are sharing your screen</Text>
                )}
                {state.sharingUserIds.length > 1 && (
                  <View
                    accessibilityLabel="Presenters"
                    style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                  >
                    {state.sharingUserIds.map((id) => {
                      const name =
                        id === state.selfId
                          ? 'your'
                          : `${state.participants.find((user) => user.id === id)?.name ?? 'Participant'}'s`;
                      return button(
                        `View ${name} screen`,
                        () => {
                          setAnnotating(false);
                          controller.viewShare(id);
                        },
                        id === state.sharingUserId,
                      );
                    })}
                  </View>
                )}
                {pageCount > 1 && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {button(
                      'Previous participants',
                      () => setPage((previous) => Math.max(0, previous - 1)),
                      page === 0,
                    )}
                    <Text style={{ color: colors.text }}>
                      Page {Math.min(page, pageCount - 1) + 1} of {pageCount}
                    </Text>
                    {button(
                      'Next participants',
                      () => setPage((previous) => Math.min(pageCount - 1, previous + 1)),
                      page >= pageCount - 1,
                    )}
                  </View>
                )}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {gridUsers.map((user) => (
                    <Pressable
                      key={user.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Focus ${user.name}`}
                      onPress={() => setFocused({ id: user.id, sharing: false })}
                      style={{
                        width:
                          gridUsers.length === 1 || (gridUsers.length <= 2 && width < 700)
                            ? '100%'
                            : '47%',
                        minHeight: 150,
                        backgroundColor: colors.card,
                        borderRadius: 12,
                        overflow: 'hidden',
                        borderWidth: 2,
                        borderColor:
                          state.speaking.includes(user.id) && !user.muted
                            ? colors.success
                            : colors.border,
                      }}
                    >
                      {user.video && focused?.id !== user.id ? (
                        <View pointerEvents="none">
                          <NativeVideoView
                            userId={user.id}
                            style={{ width: '100%', aspectRatio: 16 / 9 }}
                          />
                        </View>
                      ) : (
                        <View
                          style={{
                            aspectRatio: 16 / 9,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ color: colors.text, fontSize: 36 }}>
                            {user.name
                              .split(/\s+/)
                              .map((name) => name[0])
                              .slice(0, 2)
                              .join('')}
                          </Text>
                        </View>
                      )}
                      <Text style={{ color: colors.text, padding: 8 }}>
                        {user.name}
                        {state.raisedHands.includes(user.id) ? ' ✋' : ''}
                        {user.host ? ' · Host' : user.cohost ? ' · Co-host' : ''}
                        {user.muted ? ' · Muted' : ''}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {state.sharingUserId &&
                  state.sharingUserId !== state.selfId &&
                  button('Expand shared screen', () =>
                    setFocused({ id: state.sharingUserId!, sharing: true }),
                  )}
                <NativeMeetingToolbar>
                  {button(
                    state.microphone ? 'Mute microphone' : 'Unmute microphone',
                    () => {
                      void run(() => controller.microphone(!state.microphone));
                    },
                  )}
                  {button('Audio settings', () =>
                    setPanel(panel === 'audio' ? 'none' : 'audio'),
                  )}
                  {button('Blur background', () => {
                    void run(() => adapter.background('blur'));
                  })}
                  {button('Remove background', () => {
                    void run(() => adapter.background('none'));
                  })}
                  {button(state.camera ? 'Stop video' : 'Start video', () => {
                    void run(() => controller.camera(!state.camera));
                  })}
                  {hostEligible &&
                    !controller.self?.host &&
                    button('Claim host', () =>
                      Alert.alert(
                        'Claim host access?',
                        'The current host will become a participant.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Claim host',
                            onPress: () => {
                              void run(() => controller.claimHost());
                            },
                          },
                        ],
                      ),
                    )}
                  {button(
                    state.raisedHands.includes(state.selfId ?? '')
                      ? 'Lower hand'
                      : 'Raise hand',
                    () => {
                      void run(() =>
                        controller.raiseHand(
                          !state.raisedHands.includes(state.selfId ?? ''),
                        ),
                      );
                    },
                  )}
                  {['👏', '👍', '❤️', '😂', '🎉'].map((emoji) =>
                    button(`React ${emoji}`, () => {
                      void run(() => controller.react(emoji));
                    }),
                  )}
                  {button(captions ? 'Turn captions off' : 'Turn captions on', () => {
                    void run(async () => {
                      await adapter.captions(!captions);
                      setCaptions(!captions);
                    });
                  })}
                  {pip.supported &&
                    button(
                      'Open floating call',
                      () => {
                        void run(() => pip.enter());
                      },
                      !pip.ready,
                    )}
                  {button('Switch camera', () => {
                    void run(() => adapter.switchCamera());
                  })}
                  {adapter.mirror &&
                    button(
                      mirrored ? 'Stop mirroring my video' : 'Mirror my video',
                      () => {
                        void run(async () => {
                          await adapter.mirror?.(!mirrored);
                          setMirrored(!mirrored);
                        });
                      },
                    )}
                  {controller.self?.host &&
                    adapter.setShareMode &&
                    SHARE_MODES.map(([mode, label]) =>
                      button(
                        state.shareMode === mode ? `${label} (selected)` : label,
                        () => {
                          void run(() => controller.setShareMode(mode));
                        },
                        state.shareMode === mode,
                      ),
                    )}
                  {state.sharingUserId &&
                    state.sharingUserId !== state.selfId &&
                    button(
                      annotating ? 'Stop annotating' : 'Annotate shared screen',
                      () => setAnnotating((previous) => !previous),
                    )}
                  {button(selfSharing ? 'Stop sharing screen' : 'Share screen', () => {
                    void run(() => controller.share(!selfSharing));
                  })}
                  {controller.settings.whiteboard.enabled &&
                    button('Whiteboard', () =>
                      setPanel(panel === 'whiteboard' ? 'none' : 'whiteboard'),
                    )}
                  {controller.settings.participants.visible &&
                    button(
                      `Participants${waiting.length ? ` (${waiting.length} waiting)` : ''}`,
                      () => setPanel(panel === 'participants' ? 'none' : 'participants'),
                    )}
                  {controller.settings.messages.visible &&
                    button(
                      unreadMessages ? `Messages (${unreadMessages} unread)` : 'Messages',
                      () => setPanel(panel === 'chat' ? 'none' : 'chat'),
                    )}
                  {controller.settings.invite.enabled &&
                    credentials.sharePath &&
                    button('Invite', () => {
                      void run(() =>
                        Share.share({ message: credentials.sharePath ?? '' }).then(
                          () => {},
                        ),
                      );
                    })}
                  {moderator &&
                    controller.settings.recording.enabled &&
                    button(
                      state.recordingPaused
                        ? 'Resume recording'
                        : state.recording
                          ? controller.settings.recording.allowStop
                            ? 'Stop recording'
                            : 'Recording locked'
                          : 'Start recording',
                      () => {
                        void run(async () => {
                          await controller.recording(
                            state.recordingPaused || !state.recording,
                          );
                        });
                      },
                      state.recording &&
                        !state.recordingPaused &&
                        !controller.settings.recording.allowStop,
                    )}
                  {button('Leave meeting', () =>
                    boardPending
                      ? Alert.alert(
                          'Drawing changes are waiting to save',
                          'Keep the board open and retry saving before leaving.',
                        )
                      : Alert.alert(
                          'Leave classroom?',
                          'You can rejoin while the class is active.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Leave',
                              style: 'destructive',
                              onPress: () => {
                                void run(() => controller.leave());
                              },
                            },
                          ],
                        ),
                  )}
                  {controller.self?.host &&
                    button('End for everyone', () =>
                      boardPending
                        ? Alert.alert(
                            'Drawing changes are waiting to save',
                            'Retry saving before ending the class.',
                          )
                        : Alert.alert(
                            'End class for everyone?',
                            'Everyone will be disconnected.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'End class',
                                style: 'destructive',
                                onPress: () => {
                                  void run(async () => {
                                    await controller.leave(true);
                                    await meetingApi
                                      .audit(sessionId, 'end_session_for_all')
                                      .catch(() => {});
                                  });
                                },
                              },
                            ],
                          ),
                    )}
                </NativeMeetingToolbar>
              </>
            )}
            <NativeClassroomSettings
              open={panel === 'audio'}
              tab={settingsTab}
              onTab={setSettingsTab}
              onClose={() => {
                void run(async () => {
                  await adapter.stopAudioTests();
                  setMicTest(false);
                  setSpeakerTest(false);
                  setPanel('none');
                });
              }}
              error={error ?? state.error ?? mediaDevices.error}
              audio={
                <View style={{ gap: 8 }}>
                  {pip.supported && (
                    <View style={{ gap: 8 }}>
                      <Pressable
                        accessibilityRole="switch"
                        accessibilityLabel="Automatic floating call"
                        accessibilityState={{ checked: pip.automatic }}
                        onPress={() => {
                          void run(() => pip.changeAutomatic(!pip.automatic));
                        }}
                        style={{ minHeight: 44, padding: 12 }}
                      >
                        <Text style={{ color: colors.text }}>
                          Automatic floating call: {pip.automatic ? 'On' : 'Off'}
                        </Text>
                      </Pressable>
                      {pip.error && (
                        <Text accessibilityRole="alert" style={{ color: colors.text }}>
                          {pip.error}
                        </Text>
                      )}
                    </View>
                  )}

                  <Text style={{ color: colors.text }}>Audio device</Text>
                  {mediaDevices.devices.audio.map((device) => (
                    <Pressable
                      key={device.id}
                      testID={`audio-device-${device.id}-${device.selected ? 'selected' : 'unselected'}`}
                      accessibilityRole="radio"
                      accessibilityLabel={`Audio device: ${device.label}`}
                      accessibilityState={{ checked: device.selected }}
                      onPress={() => {
                        void run(() => mediaDevices.select('audio', device.id));
                      }}
                      style={{
                        minHeight: 44,
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: device.selected
                          ? colors.actionSubtle
                          : colors.card,
                      }}
                    >
                      <Text style={{ color: colors.text }}>
                        {device.selected ? '✓ ' : ''}
                        {device.label}
                      </Text>
                    </Pressable>
                  ))}

                  <Text accessibilityRole="header" style={{ color: colors.text }}>
                    Test your audio and video
                  </Text>
                  <Text
                    accessibilityLabel={`Microphone activity ${volume}`}
                    style={{ color: colors.text }}
                  >
                    Microphone activity: {volume}%
                  </Text>
                  <View
                    accessible
                    accessibilityRole="progressbar"
                    accessibilityLabel="Microphone level"
                    accessibilityValue={{
                      min: 0,
                      max: 100,
                      now: Math.max(0, Math.min(100, volume)),
                    }}
                    style={{
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: colors.border,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${Math.max(0, Math.min(100, volume))}%`,
                        backgroundColor: colors.success,
                      }}
                    />
                  </View>
                  {button(
                    micTest ? 'Play microphone recording' : 'Test microphone',
                    () => {
                      void run(async () => {
                        if (!(micPermission?.granted || (await requestMic()).granted))
                          throw new Error('Allow microphone access to test audio.');
                        await adapter.testMicrophone(!micTest);
                        setMicTest(!micTest);
                      });
                    },
                  )}
                  {button(speakerTest ? 'Stop speaker test' : 'Test speakers', () => {
                    void run(async () => {
                      await adapter.testSpeaker(!speakerTest);
                      setSpeakerTest(!speakerTest);
                    });
                  })}
                  {button(
                    originalAudio
                      ? 'Use noise suppression'
                      : 'Use original microphone audio',
                    () => {
                      void run(async () => {
                        await adapter.originalAudio(!originalAudio);
                        setOriginalAudio(!originalAudio);
                      });
                    },
                  )}
                  {button('Use speaker', () => {
                    void run(() => adapter.speaker(true));
                  })}
                  {button('Done testing', () => {
                    void run(async () => {
                      await adapter.stopAudioTests();
                      setMicTest(false);
                      setSpeakerTest(false);
                      setPanel('none');
                    });
                  })}
                </View>
              }
              video={
                <View style={{ gap: 12 }}>
                  {mediaDevices.devices.cameras.map((device) => (
                    <Pressable
                      key={device.id}
                      testID={`camera-device-${device.id}-${device.selected ? 'selected' : 'unselected'}`}
                      accessibilityRole="radio"
                      accessibilityLabel={`Camera device: ${device.label}`}
                      accessibilityState={{ checked: device.selected }}
                      onPress={() => {
                        void run(() => mediaDevices.select('camera', device.id));
                      }}
                      style={{
                        minHeight: 44,
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: device.selected
                          ? colors.actionSubtle
                          : colors.card,
                      }}
                    >
                      <Text style={{ color: colors.text }}>
                        {device.selected ? '✓ ' : ''}
                        {device.label}
                      </Text>
                    </Pressable>
                  ))}

                  <Text style={{ color: colors.text }}>Camera and background</Text>
                  {button('Blur background', () => {
                    void run(() => adapter.background('blur'));
                  })}
                  {button('Remove background', () => {
                    void run(() => adapter.background('none'));
                  })}
                  {button('Choose background image', () => {
                    void run(async () => {
                      const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ['images'],
                        quality: 0.8,
                      });
                      if (!result.canceled)
                        await adapter.background('image', result.assets[0].uri);
                    });
                  })}

                  {button('Switch camera', () => {
                    void run(() => adapter.switchCamera());
                  })}
                  {adapter.mirror &&
                    button(
                      mirrored ? 'Stop mirroring my video' : 'Mirror my video',
                      () => {
                        void run(async () => {
                          await adapter.mirror?.(!mirrored);
                          setMirrored(!mirrored);
                        });
                      },
                    )}
                </View>
              }
            />
            {state.phase !== 'ended' && panel === 'participants' && (
              <View style={{ gap: 8 }}>
                {waiting.map((user) => (
                  <View key={user.id}>
                    <Text style={{ color: colors.text }}>
                      {user.displayName} is waiting
                    </Text>
                    {button(`Admit ${user.displayName}`, () => {
                      void run(() =>
                        meetingApi
                          .admit(sessionId, { id: user.id, approved: true })
                          .then(() =>
                            setWaiting((previous) =>
                              previous.filter((item) => item.id !== user.id),
                            ),
                          ),
                      );
                    })}
                    {button(`Decline ${user.displayName}`, () => {
                      void run(() =>
                        meetingApi
                          .admit(sessionId, { id: user.id, approved: false })
                          .then(() =>
                            setWaiting((previous) =>
                              previous.filter((item) => item.id !== user.id),
                            ),
                          ),
                      );
                    })}
                  </View>
                ))}
                {state.participants.map((user) => (
                  <View key={user.id}>
                    <Text style={{ color: colors.text }}>{user.name}</Text>
                    {moderator &&
                      user.id !== state.selfId &&
                      button(`Mute ${user.name}`, () => {
                        void run(async () => {
                          await controller.mute(user.id);
                          await meetingApi
                            .audit(sessionId, 'mute_participant', user.name)
                            .catch(() => {});
                        });
                      })}
                    {controller.self?.host && user.id !== state.selfId && (
                      <>
                        {controller.settings.cohosts?.enabled &&
                          button(
                            `${user.cohost ? 'Remove co-host' : 'Make co-host'} ${user.name}`,
                            () => {
                              void run(() => controller.cohost(user.id, !user.cohost));
                            },
                          )}
                        {button(`Make host ${user.name}`, () =>
                          Alert.alert(
                            'Transfer host?',
                            `${user.name} will become the host.`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Transfer',
                                onPress: () => {
                                  void run(() => controller.transferHost(user.id));
                                },
                              },
                            ],
                          ),
                        )}
                      </>
                    )}
                  </View>
                ))}
              </View>
            )}
            {state.phase !== 'ended' && panel === 'chat' && (
              <View style={{ gap: 8 }}>
                {state.messages.map((message) => (
                  <Text key={message.id} style={{ color: colors.text }}>
                    {message.sender}: {message.text}
                  </Text>
                ))}
                {!state.chatAllowed && (
                  <Text style={{ color: colors.text }}>
                    The host has turned off chat.
                  </Text>
                )}
                {controller.settings.messages.enabled && state.chatAllowed && (
                  <>
                    <TextInput
                      accessibilityLabel="Message"
                      value={text}
                      onChangeText={setText}
                      maxLength={2000}
                      style={{
                        color: colors.text,
                        backgroundColor: colors.card,
                        padding: 12,
                      }}
                    />
                    {button('Send message', () => {
                      Keyboard.dismiss();
                      void run(async () => {
                        await controller.chat(text);
                        setText('');
                      });
                    })}
                  </>
                )}
              </View>
            )}
            {!preview &&
              state.phase !== 'ended' &&
              controller.settings.whiteboard.enabled &&
              credentials.whiteboard?.provider === 'excalidraw' &&
              credentials.whiteboard.token && (
                <View>
                  {state.recording && state.sharingUserId !== state.selfId && (
                    <Text style={{ color: colors.text }}>
                      Share your screen to include this whiteboard in the recording.
                    </Text>
                  )}
                  <NativeWhiteboard
                    token={credentials.whiteboard.token}
                    repository={whiteboardRepository}
                    onPresentation={onBoardPresentation}
                    onPending={setBoardPending}
                    visible={panel === 'whiteboard'}
                    onClose={() => setPanel('none')}
                    controls={
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                        {button(
                          state.microphone ? 'Mute microphone' : 'Unmute microphone',
                          () => {
                            void run(() => controller.microphone(!state.microphone));
                          },
                        )}
                        {button(state.camera ? 'Stop video' : 'Start video', () => {
                          void run(() => controller.camera(!state.camera));
                        })}
                      </View>
                    }
                  />
                </View>
              )}
            {panel === 'whiteboard' &&
              credentials.whiteboard?.provider === 'excalidraw' &&
              !credentials.whiteboard.token && (
                <Text accessibilityRole="alert" style={{ color: colors.text }}>
                  The whiteboard is unavailable. Rejoin the class to retry.
                </Text>
              )}
            {panel === 'whiteboard' &&
              credentials.whiteboard?.provider !== 'excalidraw' && (
                <View style={{ height: 450 }}>
                  <WhiteboardView style={{ flex: 1 }} />
                  {moderator &&
                    button(
                      zoomBoardActive
                        ? 'Stop presenting whiteboard'
                        : 'Present whiteboard',
                      () => {
                        void run(async () => {
                          const result = await (zoomBoardActive
                            ? zoom.whiteboardHelper.stopShareWhiteboard()
                            : zoom.whiteboardHelper.startShareWhiteboard());
                          if (
                            result !== 0 &&
                            String(result) !== 'ZoomVideoSDKError_Success'
                          )
                            throw new Error('Unable to present whiteboard.');
                        });
                      },
                    )}
                </View>
              )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}
