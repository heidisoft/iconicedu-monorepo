import React, {
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  Alert,
  AppState,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
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
  WhiteboardSnapshotVM,
  AnnotationContext,
  MeetingWaitingParticipantVM,
} from '@iconicedu/shared-types';
import {
  NativeMeetingController,
  type NativeLeaveReason,
  type NativeMeetingAdapter,
  type NativeShareMode,
} from '@/lib/classroom/meeting-controller';
import { createZoomNativeAdapter } from '@/lib/classroom/zoom-native-adapter';
import { createShareAnnotationLifecycle } from '@iconicedu/utils';
import { nativeAnnotationApi } from '@/lib/classroom/annotation-api';
import { capabilityGet, capabilityPost } from '@/lib/api/http-client';
import { generateClientMessageId } from '@/lib/messages/client-message-id';
import { classroomApi } from '@/lib/classroom/api';
import { useTheme } from '@/providers/theme-provider';
import { useNativePictureInPicture } from './use-native-picture-in-picture';
import { useNativeMediaDevices } from './use-native-media-devices';
import { NativeFocusedVideo } from './native-focused-video';
import { NativeDevicePreview } from './native-device-preview';
import { NativeClassroomSettings } from './native-classroom-settings';
import { NativeMeetingToolbar } from './native-meeting-toolbar';
import { NativeHandAndReactions, NativeMeetingStatus } from './native-meeting-dock';
import {
  NativeParticipantFilmstrip,
  NativeParticipantGallery,
} from './native-participant-gallery';
import { NativeChatSheet, NativeMeetingSheet } from './native-meeting-sheets';
import { NativeMeetingFeedback } from './native-meeting-feedback';
import type { MeetingBackgroundPreset } from '@iconicedu/utils';
import {
  BACKGROUND_PHOTOS,
  backgroundPhotoFile,
  readBackgroundPreference,
  writeBackgroundPreference,
} from '@/lib/classroom/background-catalog';
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
  const { width, height } = useWindowDimensions();
  const [cameraPermission, requestCamera, getCamera] = useCameraPermissions();
  const [micPermission, requestMic, getMic] = useMicrophonePermissions();
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
  const annotationLifecycle = useMemo(
    () =>
      createShareAnnotationLifecycle(
        (roomId, operation) =>
          nativeAnnotationApi(sessionId, '0', credentials.annotationToken).save(
            roomId,
            operation,
          ),
        generateClientMessageId,
      ),
    [sessionId, credentials.annotationToken],
  );
  const rememberAnnotations = useCallback(
    (shareKey: string, context: AnnotationContext) =>
      annotationLifecycle.remember(shareKey, context),
    [annotationLifecycle],
  );
  // Close a presenter's annotation room when their share stops, not when a viewer
  // switches between simultaneous presenters.
  const previousPresenters = useRef<string[]>([]);
  useEffect(() => {
    const stopped = previousPresenters.current.filter(
      (id) => !state.sharingUserIds.includes(id),
    );
    previousPresenters.current = state.sharingUserIds;
    stopped.forEach((id) => {
      void annotationLifecycle
        .end(id)
        .catch(() =>
          setError(
            'Unable to close screen annotations. Please retry stopping the share.',
          ),
        );
    });
  }, [state.sharingUserIds, annotationLifecycle]);
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
  const participantCount = state.participants.length;
  const otherSharing = !!state.sharingUserId && state.sharingUserId !== state.selfId;
  // Web's self-view toggle: in a 1-1 lesson the other person can take the whole stage.
  const [selfViewHidden, setSelfViewHidden] = useState(false);
  const stageParticipants =
    selfViewHidden && participantCount > 1
      ? state.participants.filter((user) => user.id !== state.selfId)
      : state.participants;
  const [stageHeight, setStageHeight] = useState(0);
  // Same single control and wording as web's leave button and dialog.
  const hostAlone = !!controller.self?.host && participantCount <= 1;
  const leaveLabel = !controller.self?.host
    ? 'Leave class'
    : hostAlone
      ? 'End class'
      : 'Leave or end class';
  const endForEveryone = () =>
    run(async () => {
      await controller.leave(true);
      await meetingApi.audit(sessionId, 'end_session_for_all').catch(() => {});
    });
  const confirmLeave = () => {
    if (boardPending) {
      Alert.alert(
        'Drawing changes are waiting to save',
        'Keep the board open and retry saving before leaving.',
      );
      return;
    }
    const leave = { text: 'Leave', onPress: () => void run(() => controller.leave()) };
    const cancel = { text: 'Cancel', style: 'cancel' as const };
    if (!controller.self?.host)
      Alert.alert(
        'Leave the class?',
        'You can rejoin anytime while the class is still live.',
        [cancel, { ...leave, style: 'destructive' }],
      );
    else if (hostAlone)
      Alert.alert(
        'End the class?',
        "You're the only one here, so this ends the class for good rather than just leaving it running.",
        [
          cancel,
          {
            text: 'End class',
            style: 'destructive',
            onPress: () => void endForEveryone(),
          },
        ],
      );
    else
      Alert.alert(
        'Leave or end the class?',
        'Leave and the class keeps going for everyone else. End it and every participant is disconnected immediately.',
        [
          cancel,
          leave,
          {
            text: 'End for everyone',
            style: 'destructive',
            onPress: () => void endForEveryone(),
          },
        ],
      );
  };
  const reactionFor = (userId: string) =>
    [...state.reactions].reverse().find((reaction) => reaction.userId === userId)?.emoji;
  const [backgroundPreset, setBackgroundPreset] =
    useState<MeetingBackgroundPreset>('none');
  useEffect(() => {
    void readBackgroundPreference().then(setBackgroundPreset);
  }, []);
  const applyBackground = useCallback(
    async (preset: MeetingBackgroundPreset) => {
      if (preset === 'none' || preset === 'blur') await adapter.background(preset);
      else await adapter.background('image', await backgroundPhotoFile(preset));
    },
    [adapter],
  );
  const selectBackground = (preset: MeetingBackgroundPreset) =>
    void run(async () => {
      // Zoom applies effects to the in-session camera; a preview choice is applied on join.
      if (state.phase === 'meeting' || state.phase === 'reconnecting')
        await applyBackground(preset);
      setBackgroundPreset(preset);
      await writeBackgroundPreference(preset);
    });
  // Like web's initial media settings, the remembered effect follows people into class.
  const backgroundRestored = useRef(false);
  useEffect(() => {
    if (state.phase !== 'meeting' || backgroundRestored.current) return;
    backgroundRestored.current = true;
    if (backgroundPreset !== 'none')
      void applyBackground(backgroundPreset).catch(() =>
        setError(
          'Your saved background could not be applied. Choose it in Video settings.',
        ),
      );
  }, [state.phase, backgroundPreset, applyBackground]);
  const backgroundChoiceStyle = (selected: boolean) => ({
    width: 96,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 4,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: selected ? colors.action : colors.border,
  });
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
  // Outside picture-in-picture the OS stops the camera in the background; turn it off
  // deliberately so others see the avatar, and turn it back on when the app returns.
  const cameraPausedInBackground = useRef(false);
  const inClass = state.phase === 'meeting' || state.phase === 'reconnecting';
  useEffect(() => {
    if (!inClass) return;
    const subscription = AppState.addEventListener('change', (next) => {
      const current = controller.snapshot();
      if (next === 'background' && current.camera && !pip.active) {
        cameraPausedInBackground.current = true;
        void controller.camera(false).catch(() => {
          cameraPausedInBackground.current = false;
        });
      } else if (next === 'active' && cameraPausedInBackground.current) {
        cameraPausedInBackground.current = false;
        void controller
          .camera(true)
          .catch(() => setError('Your camera could not restart. Turn it on again.'));
      }
    });
    return () => subscription.remove();
  }, [inClass, controller, pip.active]);
  useEffect(() => {
    const blocked = state.permissionBlocked;
    if (!blocked) return;
    // Returning from Settings clears the banner once the OS grants access again.
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      void (blocked === 'camera' ? getCamera() : getMic())
        .then((permission) => {
          if (permission.granted) controller.permissionRestored(blocked);
        })
        .catch(() => {});
    });
    return () => subscription.remove();
  }, [state.permissionBlocked, controller, getCamera, getMic]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && state.phase === 'meeting' && Platform.OS === 'ios')
        void zoom
          .isInSession()
          .then((inSession) =>
            inSession ? zoom.audioHelper.setSDKAudioSessionEnv() : undefined,
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
  // Same vocabulary as web: connection problems only, and good/bad network transitions.
  useEffect(() => {
    const level =
      state.phase === 'reconnecting'
        ? 'reconnecting'
        : state.phase === 'ended' && state.leaveReason === 'network'
          ? 'fail'
          : null;
    if (level)
      void meetingApi
        .quality(sessionId, 'connection_state', level, credentials.displayName)
        .catch(() => {});
  }, [state.phase, state.leaveReason, sessionId, credentials.displayName, meetingApi]);
  const reportedNetwork = useRef<string | null>(null);
  useEffect(() => {
    if (state.network !== 'good' && state.network !== 'bad') return;
    if (reportedNetwork.current === state.network) return;
    reportedNetwork.current = state.network;
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
  const overlays = (
    <>
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
                  backgroundColor: device.selected ? colors.actionSubtle : colors.card,
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
            {button(micTest ? 'Play microphone recording' : 'Test microphone', () => {
              void run(async () => {
                if (!(micPermission?.granted || (await requestMic()).granted))
                  throw new Error('Allow microphone access to test audio.');
                await adapter.testMicrophone(!micTest);
                setMicTest(!micTest);
              });
            })}
            {button(speakerTest ? 'Stop speaker test' : 'Test speakers', () => {
              void run(async () => {
                await adapter.testSpeaker(!speakerTest);
                setSpeakerTest(!speakerTest);
              });
            })}
            {button(
              originalAudio ? 'Use noise suppression' : 'Use original microphone audio',
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
                  backgroundColor: device.selected ? colors.actionSubtle : colors.card,
                }}
              >
                <Text style={{ color: colors.text }}>
                  {device.selected ? '✓ ' : ''}
                  {device.label}
                </Text>
              </Pressable>
            ))}

            <Text style={{ color: colors.text }}>Camera and background</Text>
            {preview && (
              <Text style={{ color: colors.textMuted }}>
                Your background is applied when you join the class.
              </Text>
            )}
            <View
              accessibilityLabel="Backgrounds"
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
            >
              {(
                [
                  ['none', 'No background effect'],
                  ['blur', 'Blur background'],
                ] as const
              ).map(([preset, label]) => (
                <Pressable
                  key={preset}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: backgroundPreset === preset }}
                  onPress={() => selectBackground(preset)}
                  style={backgroundChoiceStyle(backgroundPreset === preset)}
                >
                  <Text style={{ color: colors.text, textAlign: 'center' }}>{label}</Text>
                </Pressable>
              ))}
              {BACKGROUND_PHOTOS.map((photo) => (
                <Pressable
                  key={photo.value}
                  accessibilityRole="button"
                  accessibilityLabel={`Background photo: ${photo.label}`}
                  accessibilityState={{
                    selected: backgroundPreset === photo.value,
                  }}
                  onPress={() => selectBackground(photo.value)}
                  style={backgroundChoiceStyle(backgroundPreset === photo.value)}
                >
                  <Image
                    source={photo.source}
                    resizeMode="cover"
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      bottom: 0,
                      left: 0,
                    }}
                  />
                </Pressable>
              ))}
            </View>
            {/* Library photos are this device's own files, so they are not remembered. */}
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
              button(mirrored ? 'Stop mirroring my video' : 'Mirror my video', () => {
                void run(async () => {
                  await adapter.mirror?.(!mirrored);
                  setMirrored(!mirrored);
                });
              })}
          </View>
        }
      />
      <NativeMeetingSheet
        open={inClass && panel === 'participants'}
        title="People"
        onClose={() => setPanel('none')}
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          <View style={{ gap: 8 }}>
            {waiting.map((user) => (
              <View key={user.id}>
                <Text style={{ color: colors.text }}>{user.displayName} is waiting</Text>
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
                <Text style={{ color: colors.text, fontWeight: '500' }}>
                  {user.name}
                  {user.id === state.selfId ? ' (You)' : ''}
                </Text>
                <Text style={{ color: colors.textMuted }}>
                  {[
                    user.host ? 'Meeting host' : user.cohost ? 'Co-host' : 'In meeting',
                    user.muted ? 'Muted' : null,
                    state.raisedHands.includes(user.id) ? 'Hand raised' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
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
        </ScrollView>
      </NativeMeetingSheet>
      <NativeChatSheet
        open={inClass && panel === 'chat'}
        messages={state.messages}
        canSend={controller.settings.messages.enabled && state.chatAllowed}
        blockedReason={state.chatAllowed ? undefined : 'The host has turned off chat.'}
        onSend={(message) => run(() => controller.chat(message)).then(() => {})}
        onClose={() => setPanel('none')}
      />
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
      <NativeMeetingSheet
        open={
          inClass &&
          panel === 'whiteboard' &&
          credentials.whiteboard?.provider !== 'excalidraw'
        }
        title="Whiteboard"
        onClose={() => setPanel('none')}
      >
        <View style={{ flex: 1, padding: 12, gap: 8 }}>
          <WhiteboardView style={{ flex: 1 }} />
          {moderator &&
            button(
              zoomBoardActive ? 'Stop presenting whiteboard' : 'Present whiteboard',
              () => {
                void run(async () => {
                  const result = await (zoomBoardActive
                    ? zoom.whiteboardHelper.stopShareWhiteboard()
                    : zoom.whiteboardHelper.startShareWhiteboard());
                  if (result !== 0 && String(result) !== 'ZoomVideoSDKError_Success')
                    throw new Error('Unable to present whiteboard.');
                });
              },
            )}
        </View>
      </NativeMeetingSheet>
    </>
  );
  const focusedVideo = (
    <NativeFocusedVideo
      user={state.participants.find((user) => user.id === focused?.id)}
      sharing={focused?.sharing ?? false}
      shareContent={
        focused?.sharing ? (
          <NativeShareStage
            sessionId={sessionId}
            userId={focused.id}
            token={credentials.annotationToken}
            height={Math.max(180, height - 130)}
            annotating={annotating}
            composited={state.composited.includes(focused.id)}
            onContext={rememberAnnotations}
          />
        ) : undefined
      }
      onClose={() => setFocused(null)}
    />
  );
  if (inClass)
    return (
      <>
        {focusedVideo}
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
          >
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text
                accessibilityRole="header"
                numberOfLines={1}
                style={{
                  color: colors.text,
                  fontSize: 18,
                  fontWeight: '500',
                  flexShrink: 1,
                }}
              >
                {title ?? credentials.sessionName}
              </Text>
              <Text style={{ color: colors.textMuted }}>
                · {participantCount} {participantCount === 1 ? 'Attendee' : 'Attendees'}
              </Text>
            </View>
            <NativeMeetingStatus
              recording={state.recording}
              paused={state.recordingPaused}
            />
          </View>
          <View style={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}>
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
            {state.network === 'bad' && (
              <Text accessibilityRole="alert" style={{ color: colors.text }}>
                Your connection is unstable. Video may pause while it recovers.
              </Text>
            )}
            {state.audioInterrupted && (
              <Text accessibilityRole="alert" style={{ color: colors.text }}>
                Classroom audio is paused by another call. It resumes when that call ends.
              </Text>
            )}
            {state.permissionBlocked && (
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
                  {state.permissionBlocked === 'camera'
                    ? 'Camera access is blocked. Allow camera access in Settings to be seen.'
                    : 'Microphone access is blocked. Allow microphone access in Settings to be heard.'}
                </Text>
                {button('Open Settings', () => {
                  void Linking.openSettings();
                })}
              </View>
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
                      ? 'Decline and leave'
                      : "Don't record me",
                    () => {
                      void run(() => controller.respondToRecordingConsent(false));
                    },
                  )}
                </View>
              </View>
            )}
          </View>
          <View style={{ flex: 1, paddingHorizontal: 12, gap: 8 }}>
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
            {state.sharingUserId ? (
              <>
                <View
                  style={{ flex: 1 }}
                  onLayout={(event) => setStageHeight(event.nativeEvent.layout.height)}
                >
                  {otherSharing && focused?.id !== state.sharingUserId ? (
                    <NativeShareStage
                      sessionId={sessionId}
                      onContext={rememberAnnotations}
                      userId={state.sharingUserId}
                      token={credentials.annotationToken}
                      height={stageHeight}
                      annotating={annotating}
                      composited={state.composited.includes(state.sharingUserId)}
                    />
                  ) : !otherSharing ? (
                    <View
                      style={{
                        flex: 1,
                        borderRadius: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.card,
                      }}
                    >
                      <Text style={{ color: colors.text }}>
                        You are sharing your screen
                      </Text>
                    </View>
                  ) : null}
                </View>
                <NativeParticipantFilmstrip
                  participants={stageParticipants}
                  selfId={state.selfId}
                  speaking={state.speaking}
                  raisedHands={state.raisedHands}
                  reactionFor={reactionFor}
                  onFocus={(id) => setFocused({ id, sharing: false })}
                />
              </>
            ) : (
              <NativeParticipantGallery
                participants={stageParticipants}
                selfId={state.selfId}
                speaking={state.speaking}
                raisedHands={state.raisedHands}
                reactionFor={reactionFor}
                hiddenVideoId={focused?.id}
                onFocus={(id) => setFocused({ id, sharing: false })}
              />
            )}
            {captions && !!state.caption && (
              <Text
                accessibilityLiveRegion="polite"
                style={{
                  position: 'absolute',
                  left: 24,
                  right: 24,
                  bottom: 16,
                  padding: 10,
                  borderRadius: 10,
                  textAlign: 'center',
                  color: '#fff',
                  backgroundColor: 'rgba(0,0,0,0.8)',
                }}
              >
                {state.caption}
              </Text>
            )}
          </View>
          <View style={{ padding: 12, gap: 8 }}>
            <NativeHandAndReactions
              raised={state.raisedHands.includes(state.selfId ?? '')}
              onHand={() => {
                void run(() =>
                  controller.raiseHand(!state.raisedHands.includes(state.selfId ?? '')),
                );
              }}
              onReact={(emoji) => {
                void run(() => controller.react(emoji));
              }}
            />
            <NativeMeetingToolbar>
              {button(state.microphone ? 'Mute microphone' : 'Unmute microphone', () => {
                void run(() => controller.microphone(!state.microphone));
              })}
              {button('Audio settings', () =>
                setPanel(panel === 'audio' ? 'none' : 'audio'),
              )}
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
                button(mirrored ? 'Stop mirroring my video' : 'Mirror my video', () => {
                  void run(async () => {
                    await adapter.mirror?.(!mirrored);
                    setMirrored(!mirrored);
                  });
                })}
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
                button(annotating ? 'Stop annotating' : 'Annotate shared screen', () =>
                  setAnnotating((previous) => !previous),
                )}
              {button(selfSharing ? 'Stop sharing screen' : 'Share screen', () => {
                void run(() => controller.share(!selfSharing));
              })}
              {controller.settings.whiteboard.enabled &&
                button('Whiteboard', () => {
                  void run(async () => {
                    if (boardPending)
                      throw new Error('Wait for whiteboard changes to save.');
                    const access = credentials.whiteboard;
                    if (access?.provider !== 'excalidraw' || !access.token) {
                      setPanel(panel === 'whiteboard' ? 'none' : 'whiteboard');
                      return;
                    }
                    const board = whiteboardRepository
                      ? await whiteboardRepository.load()
                      : await capabilityGet<WhiteboardSnapshotVM>(
                          '/whiteboards/current',
                          access.token,
                        );
                    if (board.role !== 'teacher') {
                      setPanel(panel === 'whiteboard' ? 'none' : 'whiteboard');
                      return;
                    }
                    const operation = {
                      id: generateClientMessageId(),
                      type: 'presentation' as const,
                      enabled: !board.presentationActive,
                    };
                    const saved = whiteboardRepository
                      ? await whiteboardRepository.save(operation)
                      : await capabilityPost<WhiteboardSnapshotVM>(
                          '/whiteboards/current/operations',
                          access.token,
                          operation,
                        );
                    onBoardPresentation(saved.presentationActive === true);
                  });
                })}
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
                    Share.share({ message: credentials.sharePath ?? '' }).then(() => {}),
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
              {participantCount > 1 &&
                button(selfViewHidden ? 'Show self-view' : 'Hide self-view', () =>
                  setSelfViewHidden((previous) => !previous),
                )}
              {otherSharing &&
                button('Expand shared screen', () =>
                  setFocused({ id: state.sharingUserId!, sharing: true }),
                )}
              {button(leaveLabel, confirmLeave)}
            </NativeMeetingToolbar>
          </View>
          {overlays}
        </SafeAreaView>
      </>
    );
  return (
    <>
      {focusedVideo}
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
              {preview ? 'Ready to join?' : LEAVE_TITLES[state.leaveReason ?? 'self']}
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
            {state.network === 'bad' && (
              <Text accessibilityRole="alert" style={{ color: colors.text }}>
                Your connection is unstable. Video may pause while it recovers.
              </Text>
            )}
            {state.audioInterrupted && (
              <Text accessibilityRole="alert" style={{ color: colors.text }}>
                Classroom audio is paused by another call. It resumes when that call ends.
              </Text>
            )}
            {state.permissionBlocked && (
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
                  {state.permissionBlocked === 'camera'
                    ? 'Camera access is blocked. Allow camera access in Settings to be seen.'
                    : 'Microphone access is blocked. Allow microphone access in Settings to be heard.'}
                </Text>
                {button('Open Settings', () => {
                  void Linking.openSettings();
                })}
              </View>
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
                      ? 'Decline and leave'
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
            ) : (
              <NativeMeetingFeedback
                onSubmit={(rating) =>
                  run(() =>
                    meetingApi
                      .feedback(sessionId, rating, credentials.displayName)
                      .then(() => router.back()),
                  )
                }
                onSkip={() => router.back()}
              >
                {onRejoin && button('Rejoin classroom', onRejoin)}
              </NativeMeetingFeedback>
            )}
            {overlays}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}
