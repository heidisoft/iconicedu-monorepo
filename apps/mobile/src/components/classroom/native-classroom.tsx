import { useMeetingAlert } from './use-meeting-alert';
import { NativePresentationControls } from './native-presentation-controls';
import { NativeBackgroundPicker } from './native-background-picker';
import { NativeSettingDeviceSelect } from './native-setting-device-select';
import { NativePreviewAvatar } from './native-preview-avatar';
import { NativeClassroomHeader } from './native-classroom-header';
import { NativeParticipantRow } from './native-participant-row';
import { NativeClassroomError } from './native-classroom-error';
import { NativeSharingNotice } from './native-sharing-notice';
import { NativeConnectionHelp } from './native-connection-help';
import { NativeScreenAnnotations } from './native-screen-annotations';
import { useNativeRecordingComposition } from './use-native-recording-composition';
import { NativeInvitationSheet } from './native-invitation-sheet';
import React, {
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
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
import { generateClientMessageId } from '@/lib/messages/client-message-id';
import { capabilityGet, capabilityPost } from '@/lib/api/http-client';
import { classroomApi } from '@/lib/classroom/api';
import { useTheme } from '@/providers/theme-provider';
import { useNativePictureInPicture } from './use-native-picture-in-picture';
import { useNativeMediaDevices } from './use-native-media-devices';
import { NativeFocusedVideo } from './native-focused-video';
import { NativeDevicePreview } from './native-device-preview';
import {
  Mic,
  MicOff,
  VideoOff,
  Volume2,
  Video,
  ScanFace,
  Waves,
  Maximize2,
  PictureInPicture2,
  Users,
  UserCheck,
  UserX,
  ShieldCheck,
  ShieldOff,
  Presentation,
  MonitorUp,
  MonitorX,
  MessageCircle,
  Settings,
  Captions,
  Share as ShareIcon,
  Circle,
  Pause,
  Play,
  Square,
  PhoneOff,
  ImagePlus,
  LogIn,
  Check,
} from 'lucide-react-native';
import {
  NativeClassroomSettings,
  ClassroomSettingRow,
} from './native-classroom-settings';
import { NativeMeetingToolbar } from './native-meeting-toolbar';
import {
  NativeHandAndReactions,
  NativeMeetingStatus,
  NativeRecordingIndicator,
} from './native-meeting-dock';
import {
  NativeParticipantFilmstrip,
  NativeParticipantGallery,
} from './native-participant-gallery';
import { NativeChatSheet, NativeMeetingSheet } from './native-meeting-sheets';
import { NativeMeetingFeedback } from './native-meeting-feedback';
import type { MeetingBackgroundPreset } from '@iconicedu/utils';
import {
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
  autoJoin = false,
  initialPreview,
  previewDisplayName,
  studentChoices,
  joinDisabled = false,
  onRejoin,
  meetingApi = classroomApi,
}: {
  sessionId: string;
  /** The class title shown to people; `credentials.sessionName` is Zoom's session key. */
  title?: string;
  credentials?: LiveSessionJoinCredentialsVM;
  previewDisplayName?: string;
  studentChoices?: React.ReactNode;
  joinDisabled?: boolean;
  hostEligible?: boolean;
  adapterOverride?: NativeMeetingAdapter;
  whiteboardRepository?: NativeWhiteboardRepository;
  meetingApi?: Pick<
    typeof classroomApi,
    'waiting' | 'admit' | 'audit' | 'quality' | 'feedback'
  >;
  onRejoin?: () => void;
  autoJoin?: boolean;
  initialPreview?: { camera: boolean; microphone: boolean };
  authorize?: (displayNameOverride?: string) => Promise<LiveSessionJoinCredentialsVM>;
}) {
  const [authorizedCredentials, setCredentials] = useState(initialCredentials);
  const credentials: Partial<LiveSessionJoinCredentialsVM> & {
    displayName: string;
    sessionName: string;
  } = authorizedCredentials ?? {
    displayName: previewDisplayName ?? '',
    sessionName: title ?? '',
  };
  const [authorizing, setAuthorizing] = useState(false);
  const zoom = useZoom();
  const [adapter] = useState(() => adapterOverride ?? createZoomNativeAdapter(zoom));
  const [controller] = useState(() => {
    const controller = new NativeMeetingController(adapter, initialCredentials);
    if (initialPreview) controller.setPreview(initialPreview);
    return controller;
  });
  const [invitationOpen, setInvitationOpen] = useState(false);
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const { colors } = useTheme();
  const showAlert = useMeetingAlert();
  const { width, height } = useWindowDimensions();
  const [cameraPermission, requestCamera, getCamera] = useCameraPermissions();
  const [micPermission, requestMic, getMic] = useMicrophonePermissions();
  useNativeRecordingComposition(adapter, controller, state);
  const boardPublisher = useRef<(() => Promise<void>) | null>(null);
  const boardPublishing = useRef(false);
  const [panel, setPanel] = useState<
    'none' | 'audio' | 'participants' | 'chat' | 'whiteboard'
  >('none');
  const [settingsTab, setSettingsTab] = useState<'audio' | 'video' | 'meeting'>('audio');
  const mediaDevices = useNativeMediaDevices(adapter, panel === 'audio');
  const [boardPending, setBoardPending] = useState(false);
  const [boardVisible, setBoardVisible] = useState(false);
  const [boardActive, setBoardActive] = useState(false);
  const [boardExpanded, setBoardExpanded] = useState(false);
  const [focused, setFocused] = useState<{ id: string; sharing: boolean } | null>(null);
  useEffect(() => {
    if (
      focused &&
      ((state.phase !== 'meeting' && state.phase !== 'reconnecting') ||
        (focused.sharing && !state.sharingUserIds.includes(focused.id)))
    )
      setFocused(null);
  }, [focused, state.phase, state.sharingUserIds]);
  const pip = useNativePictureInPicture(
    adapter.pictureInPicture,
    state,
    focused?.id,
    boardPending ||
      (Platform.OS === 'android' && (boardVisible || panel === 'whiteboard')),
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
        setPanel((previous) =>
          sharing || canStop
            ? 'whiteboard'
            : previous === 'whiteboard'
              ? 'none'
              : previous,
        );
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
    (active: boolean) => {
      setBoardActive(active);
      if (!active && boardPublishing.current) {
        boardPublishing.current = false;
        void adapter
          .share(false)
          .catch(() => setError('Unable to stop whiteboard publishing. Please retry.'));
      }
      setBoardVisible(active);
      if (!active) setBoardExpanded(false);
    },
    [adapter],
  );
  const previousShares = useRef(new Set<string>());
  useEffect(() => {
    const started = state.sharingUserIds.some((id) => !previousShares.current.has(id));
    previousShares.current = new Set(state.sharingUserIds);
    if (started && !boardPublishing.current) {
      // A new SDK share replaces the local board view without stopping the class board.
      setBoardVisible(false);
      setBoardExpanded(false);
      setPanel((previous) => (previous === 'whiteboard' ? 'none' : previous));
      setFocused((previous) => (previous?.sharing ? null : previous));
    }
  }, [state.sharingUserIds]);
  useEffect(() => {
    if (
      focused &&
      ((state.phase !== 'meeting' && state.phase !== 'reconnecting') ||
        (focused.sharing && !state.sharingUserIds.includes(focused.id)))
    )
      setFocused(null);
  }, [focused, state.phase, state.sharingUserIds]);
  const [annotating, setAnnotating] = useState(false);
  const [captions, setCaptions] = useState(false);
  const [displayName, setDisplayName] = useState(credentials.displayName);
  useEffect(() => {
    if (previewDisplayName !== undefined) setDisplayName(previewDisplayName);
  }, [previewDisplayName]);
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
      setBoardVisible(false);
      setBoardExpanded(false);
      setFocused(null);
    }
  }, [state.phase]);

  const [recordingPending, setRecordingPending] = useState(false);
  const recordingBusy = useRef(false);
  const [shareContext, setShareContext] = useState<AnnotationContext | null>(null);
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
  const changeRecording = useCallback(
    async (action: () => Promise<unknown>, publishContent = true) => {
      if (recordingBusy.current) return;
      recordingBusy.current = true;
      setRecordingPending(true);
      setError(null);
      try {
        if (
          publishContent &&
          boardVisible &&
          !boardPublishing.current &&
          boardPublisher.current
        ) {
          boardPublishing.current = true;
          try {
            await boardPublisher.current();
          } catch (cause) {
            boardPublishing.current = false;
            throw cause;
          }
          if (state.selfId) controller.composition(state.selfId, true);
        }
        await action();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Unable to update recording. Please retry.',
        );
      } finally {
        recordingBusy.current = false;
        setRecordingPending(false);
      }
    },
    [boardVisible, controller, state.selfId],
  );
  useEffect(() => {
    if (
      state.recording &&
      !state.recordingPaused &&
      boardVisible &&
      !boardPublishing.current &&
      adapter.startWhiteboardShare &&
      boardPublisher.current
    )
      void changeRecording(async () => {});
  }, [adapter, boardVisible, state.recording, state.recordingPaused, changeRecording]);
  const recordingNotice = useRef<string | null>(null);
  useEffect(() => {
    const consent = state.recordingConsent;
    if (!consent) {
      recordingNotice.current = null;
      return;
    }
    let retry: ReturnType<typeof setTimeout> | undefined;
    const notify = () => {
      if (recordingNotice.current === consent) return;
      const shown = showAlert(
        'This class is being recorded',
        consent === 'traditional'
          ? 'The host is recording this class. You can leave if you do not want to be recorded.'
          : 'The host would like to include your audio and video in the recording.',
        [
          {
            text: consent === 'traditional' ? 'Leave class' : "Don't record me",
            style: 'cancel',
            onPress: () => {
              void controller
                .respondToRecordingConsent(false)
                .catch(() =>
                  setError('Unable to update your recording preference. Try again.'),
                );
            },
          },
          {
            text: 'OK',
            onPress: () => {
              void controller
                .respondToRecordingConsent(true)
                .catch(() =>
                  setError('Unable to update your recording preference. Try again.'),
                );
            },
          },
        ],
        { cancelable: false },
      );
      if (shown) recordingNotice.current = consent;
      else retry = setTimeout(notify, 500);
    };
    notify();
    return () => {
      if (retry) clearTimeout(retry);
    };
  }, [state.recordingConsent, controller, showAlert]);
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
  const landscape = width > height;
  const hasPresentation = boardVisible || !!state.sharingUserId;
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
      showAlert(
        'Drawing changes are waiting to save',
        'Keep the board open and retry saving before leaving.',
      );
      return;
    }
    const leave = { text: 'Leave', onPress: () => void run(() => controller.leave()) };
    const cancel = { text: 'Cancel', style: 'cancel' as const };
    if (!controller.self?.host)
      showAlert(
        'Leave the class?',
        'You can rejoin anytime while the class is still live.',
        [cancel, { ...leave, style: 'destructive' }],
      );
    else if (hostAlone)
      showAlert(
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
      showAlert(
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
    setShareContext(null);
    if (!inClass || !moderator || !state.sharingUserId) return;
    let active = true;
    const shareKey = state.sharingUserId;
    const api = nativeAnnotationApi(sessionId, shareKey, credentials.annotationToken);
    const refresh = async () => {
      try {
        const context = await api.load();
        if (!active) return;
        setShareContext(context);
        rememberAnnotations(shareKey, context);
      } catch {
        if (active)
          setError('Unable to open screen annotations. Check your connection and retry.');
      }
    };
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 1500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [
    inClass,
    moderator,
    state.sharingUserId,
    sessionId,
    credentials.annotationToken,
    rememberAnnotations,
  ]);
  useEffect(() => {
    if (!inClass) return;
    let pauseTimer: ReturnType<typeof setTimeout> | undefined;
    let background = AppState.currentState === 'background';
    const pauseCamera = () => {
      if (!background || !controller.snapshot().camera) return;
      cameraPausedInBackground.current = true;
      void controller.camera(false).catch(() => {
        cameraPausedInBackground.current = false;
      });
    };
    const change = (next: string) => {
      if (pauseTimer) clearTimeout(pauseTimer);
      background = next === 'background';
      if (background && controller.snapshot().camera && !pip.active) {
        // AVKit's automatic-entry event may arrive after the app backgrounds.
        // If it never starts, retain the normal background camera protection.
        if (pip.automatic && pip.ready) pauseTimer = setTimeout(pauseCamera, 1500);
        else pauseCamera();
      } else if (next === 'active' && cameraPausedInBackground.current) {
        cameraPausedInBackground.current = false;
        void controller
          .camera(true)
          .catch(() => setError('Your camera could not restart. Turn it on again.'));
      }
    };
    const subscription = AppState.addEventListener('change', change);
    if (background) change('background');
    return () => {
      subscription.remove();
      if (pauseTimer) clearTimeout(pauseTimer);
    };
  }, [inClass, controller, pip.active, pip.automatic, pip.ready]);
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
    void changeRecording(() => controller.recording(true));
  }, [controller, state.phase, state.participants, changeRecording]);
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
  const button = (label: string, action: () => void, disabled = false) => {
    const Icon = label.startsWith('Admit')
      ? UserCheck
      : label.startsWith('Decline')
        ? UserX
        : label.startsWith('Remove co-host')
          ? ShieldOff
          : /host|participant annotations/.test(label)
            ? ShieldCheck
            : label.startsWith('Mute')
              ? Mic
              : label.startsWith('Unmute')
                ? MicOff
                : /video|camera/.test(label)
                  ? Video
                  : /Settings/.test(label)
                    ? Settings
                    : /captions/.test(label)
                      ? Captions
                      : /whiteboard/.test(label.toLowerCase())
                        ? Presentation
                        : label.startsWith('Participants')
                          ? Users
                          : label.startsWith('Messages')
                            ? MessageCircle
                            : label === 'Invite'
                              ? ShareIcon
                              : label.startsWith('Stop sharing')
                                ? MonitorX
                                : label === 'Share screen'
                                  ? MonitorUp
                                  : /floating/.test(label)
                                    ? PictureInPicture2
                                    : label.startsWith('Expand')
                                      ? Maximize2
                                      : label === 'Pause recording'
                                        ? Pause
                                        : label === 'Resume recording'
                                          ? Play
                                          : label === 'Stop recording'
                                            ? Square
                                            : /recording/.test(label) &&
                                                !label.startsWith('Allow')
                                              ? Circle
                                              : /consent|Allow recording/.test(label)
                                                ? Check
                                                : /leave|Leave|End class/.test(label)
                                                  ? PhoneOff
                                                  : /background/.test(label)
                                                    ? ImagePlus
                                                    : /Rejoin/.test(label)
                                                      ? LogIn
                                                      : Users;
    return (
      <Pressable
        key={label}
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        accessibilityState={{
          disabled,
          ...(label === 'Whiteboard' ? { selected: boardVisible } : {}),
        }}
        onPress={action}
        style={{
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 12,
          borderRadius: 12,
          backgroundColor: colors.actionSubtle,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Icon size={20} color={colors.text} />
        <Text style={{ color: colors.text, flexShrink: 1 }}>{label}</Text>
      </Pressable>
    );
  };
  const join = () =>
    run(async () => {
      if (joinDisabled || authorizing) return;
      setAuthorizing(true);
      try {
        if (
          state.camera &&
          !(cameraPermission?.granted || (await requestCamera()).granted)
        )
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
          : authorizedCredentials;
        if (!fresh) throw new Error('Join authorization is required.');
        setCredentials(fresh);
        await controller.join(fresh);
      } finally {
        setAuthorizing(false);
      }
    });
  const autoJoined = useRef(false);
  useEffect(() => {
    if (!autoJoin || autoJoined.current || state.phase !== 'preview') return;
    autoJoined.current = true;
    void join();
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
  const stopSharing = async () => {
    const wasBoard = boardPublishing.current;
    await controller.share(false);
    boardPublishing.current = false;
    if (wasBoard && credentials.whiteboard?.token) {
      const operation = {
        id: generateClientMessageId(),
        type: 'presentation' as const,
        enabled: false,
      };
      try {
        if (whiteboardRepository) await whiteboardRepository.save(operation);
        else
          await capabilityPost<WhiteboardSnapshotVM>(
            '/whiteboards/current/operations',
            credentials.whiteboard.token,
            operation,
          );
      } catch (cause) {
        setError(
          'Screen sharing stopped, but the class whiteboard is still open. Return to the board and retry stopping its presentation.',
        );
        throw cause;
      }
      setBoardVisible(false);
      setBoardExpanded(false);
    }
  };
  const whiteboardStage = (
    <>
      {selfSharing && !boardPublishing.current && state.selfId && (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', left: -10000, width, height }}
        >
          <NativeScreenAnnotations
            sessionId={sessionId}
            shareKey={state.selfId}
            token={credentials.annotationToken}
            width={width}
            height={height}
            active={false}
            publishing
          />
        </View>
      )}
      {!preview &&
        state.phase !== 'ended' &&
        controller.settings.whiteboard.enabled &&
        credentials.whiteboard?.provider === 'excalidraw' &&
        credentials.whiteboard.token && (
          <View
            style={{
              flex: boardVisible ? 1 : 0,
              display: boardVisible ? 'flex' : 'none',
            }}
          >
            <NativeWhiteboard
              token={credentials.whiteboard.token}
              onPublisher={(publish) => {
                boardPublisher.current = publish;
              }}
              publishView={adapter.startWhiteboardShare}
              repository={whiteboardRepository}
              onPresentation={onBoardPresentation}
              onPending={setBoardPending}
              visible={boardVisible}
              embedded={!boardExpanded}
              onExpand={() => setBoardExpanded(!boardExpanded)}
              expanded={boardExpanded}
              onClose={() => {
                if (boardExpanded) setBoardExpanded(false);
                else {
                  setBoardVisible(false);
                }
              }}
              controls={
                boardExpanded ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 8,
                      flexWrap: 'wrap',
                      alignItems: 'center',
                    }}
                  >
                    {selfSharing && (
                      <NativeSharingNotice
                        whiteboard={boardPublishing.current}
                        onStop={stopSharing}
                      />
                    )}
                    <NativeRecordingIndicator
                      recording={state.recording}
                      paused={state.recordingPaused}
                    />
                    {(
                      [
                        [
                          state.microphone ? 'Mute microphone' : 'Unmute microphone',
                          state.microphone ? Mic : MicOff,
                          () => {
                            void run(() => controller.microphone(!state.microphone));
                          },
                        ],
                        [
                          state.camera ? 'Stop video' : 'Start video',
                          state.camera ? Video : VideoOff,
                          () => {
                            void run(() => controller.camera(!state.camera));
                          },
                        ],
                      ] as const
                    ).map(([label, Icon, action]) => (
                      <Pressable
                        key={label}
                        accessibilityRole="button"
                        accessibilityLabel={label}
                        onPress={action}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: colors.card,
                          borderWidth: 1,
                          borderColor: colors.border,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon size={20} color={colors.text} />
                      </Pressable>
                    ))}
                  </View>
                ) : undefined
              }
            />
          </View>
        )}
    </>
  );
  const overlays = (
    <>
      <NativeClassroomSettings
        open={panel === 'audio'}
        tab={settingsTab}
        onTab={(tab) => {
          setSettingsTab(tab);
          if (settingsTab === 'audio' && tab !== 'audio') {
            setMicTest(false);
            setSpeakerTest(false);
            void run(() => adapter.stopAudioTests());
          }
        }}
        onClose={() => {
          void run(async () => {
            try {
              await adapter.stopAudioTests();
            } finally {
              setMicTest(false);
              setSpeakerTest(false);
              setPanel('none');
            }
          });
        }}
        error={error ?? state.error ?? mediaDevices.error}
        audio={
          <View style={{ gap: 8 }}>
            <NativeSettingDeviceSelect
              label="Microphone"
              icon={Mic}
              devices={mediaDevices.devices.microphones ?? []}
              onSelect={(id) => mediaDevices.select('microphone', id)}
            />
            {mediaDevices.devices.microphoneRouting === 'linked' && (
              <Text
                style={{ color: colors.textMuted, fontSize: 12, paddingHorizontal: 10 }}
              >
                Microphone and audio output switch together on this device.
              </Text>
            )}
            <ClassroomSettingRow
              label="Microphone on"
              icon={state.microphone ? Mic : MicOff}
              checked={state.microphone}
              onChange={(enabled) => {
                void run(async () => {
                  if (
                    enabled &&
                    !(micPermission?.granted || (await requestMic()).granted)
                  )
                    throw new Error(
                      'Allow microphone access to turn on your microphone.',
                    );
                  if (preview) controller.setPreview({ microphone: enabled });
                  else await controller.microphone(enabled);
                });
              }}
            />
            <NativeSettingDeviceSelect
              label="Audio output"
              icon={Volume2}
              devices={mediaDevices.devices.audio}
              onSelect={(id) => mediaDevices.select('audio', id)}
            />
            <Text
              style={{ color: colors.textMuted, fontSize: 12, paddingHorizontal: 10 }}
            >
              Use your device’s volume buttons to adjust sound.
            </Text>
            <Text accessibilityRole="header" style={{ color: colors.text }}>
              Device check
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
                height: 4,
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
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <ClassroomSettingRow
                  icon={Mic}
                  label={micTest ? 'Play recording' : 'Test microphone'}
                  accessibilityLabel={
                    micTest ? 'Play microphone recording' : 'Test microphone'
                  }
                  onPress={() => {
                    void run(async () => {
                      if (!(micPermission?.granted || (await requestMic()).granted))
                        throw new Error('Allow microphone access to test audio.');
                      await adapter.testMicrophone(!micTest);
                      setMicTest(!micTest);
                    });
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ClassroomSettingRow
                  icon={Volume2}
                  label={speakerTest ? 'Stop test' : 'Test speakers'}
                  accessibilityLabel={speakerTest ? 'Stop speaker test' : 'Test speakers'}
                  onPress={() => {
                    void run(async () => {
                      await adapter.testSpeaker(!speakerTest);
                      setSpeakerTest(!speakerTest);
                    });
                  }}
                />
              </View>
            </View>
            <ClassroomSettingRow
              label="Original sound"
              value={
                originalAudio
                  ? 'Music mode: noise suppression is off. Headphones help prevent echo.'
                  : 'Speech mode reduces background noise. Turn on for music or instruments.'
              }
              icon={Waves}
              checked={originalAudio}
              onChange={(enabled) => {
                void run(async () => {
                  await adapter.originalAudio(enabled);
                  setOriginalAudio(enabled);
                });
              }}
            />
          </View>
        }
        meeting={
          pip.supported || (controller.self?.host && adapter.setShareMode) ? (
            <View style={{ gap: 4 }}>
              {pip.supported && (
                <ClassroomSettingRow
                  label="Automatic floating call"
                  icon={PictureInPicture2}
                  checked={pip.automatic}
                  onChange={(enabled) => {
                    void run(() => pip.changeAutomatic(enabled));
                  }}
                />
              )}
              {pip.error && (
                <Text accessibilityRole="alert" style={{ color: colors.red }}>
                  {pip.error}
                </Text>
              )}
              {controller.self?.host && adapter.setShareMode && (
                <>
                  <Text style={{ color: colors.textMuted, fontSize: 12, padding: 10 }}>
                    SCREEN SHARING
                  </Text>
                  {SHARE_MODES.map(([mode, label]) => (
                    <ClassroomSettingRow
                      key={mode}
                      label={label}
                      icon={Users}
                      selected={state.shareMode === mode}
                      onPress={() => {
                        void run(() => controller.setShareMode(mode));
                      }}
                    />
                  ))}
                </>
              )}
            </View>
          ) : undefined
        }
        video={
          <View style={{ gap: 12 }}>
            <NativeSettingDeviceSelect
              label="Camera"
              icon={Video}
              devices={mediaDevices.devices.cameras}
              onSelect={(id) => mediaDevices.select('camera', id)}
            />
            {adapter.mirror && (
              <ClassroomSettingRow
                label="Mirror my video"
                icon={ScanFace}
                checked={mirrored}
                onChange={(enabled) => {
                  void run(async () => {
                    await adapter.mirror?.(enabled);
                    setMirrored(enabled);
                  });
                }}
              />
            )}
            {inClass && participantCount > 1 && (
              <ClassroomSettingRow
                label="Show self-view"
                icon={Video}
                checked={!selfViewHidden}
                onChange={(enabled) => setSelfViewHidden(!enabled)}
              />
            )}
            <NativeBackgroundPicker
              value={backgroundPreset}
              preview={preview}
              onSelect={selectBackground}
              onUpload={() => {
                void run(async () => {
                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    quality: 0.8,
                  });
                  if (!result.canceled)
                    await adapter.background('image', result.assets[0].uri);
                });
              }}
            />
          </View>
        }
      />
      <NativeMeetingSheet
        open={inClass && panel === 'participants'}
        title="People"
        sidePanel
        onClose={() => setPanel('none')}
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          <View style={{ gap: 8 }}>
            <View
              style={{
                borderRadius: 28,
                padding: 16,
                backgroundColor: colors.action,
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 12,
              }}
            >
              <Text style={{ color: colors.actionForeground, fontWeight: '600' }}>
                In meeting
              </Text>
              <Text style={{ color: colors.actionForeground }}>
                {state.participants.length}
              </Text>
            </View>
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
              <NativeParticipantRow
                key={user.id}
                user={user}
                isYou={user.id === state.selfId}
                handRaised={state.raisedHands.includes(user.id)}
                canManage={user.id === state.selfId || (!!moderator && !user.host)}
              >
                {user.id === state.selfId && (
                  <>
                    {button(
                      state.microphone ? 'Mute microphone' : 'Unmute microphone',
                      () => {
                        void run(() => controller.microphone(!state.microphone));
                      },
                    )}
                    {button(state.camera ? 'Stop video' : 'Start video', () => {
                      void run(() => controller.camera(!state.camera));
                    })}
                    {state.raisedHands.includes(user.id) &&
                      button('Lower hand', () => {
                        void run(() => controller.raiseHand(false));
                      })}
                  </>
                )}
                {moderator &&
                  !user.host &&
                  user.id !== state.selfId &&
                  (!user.cohost || controller.self?.host) &&
                  button(`Remove ${user.name}`, () =>
                    showAlert(
                      'Remove participant?',
                      `${user.name} will leave this class.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: () => {
                            void run(() => controller.removeParticipant(user.id));
                          },
                        },
                      ],
                    ),
                  )}
                {moderator &&
                  !user.host &&
                  !user.muted &&
                  user.id !== state.selfId &&
                  button(`Mute ${user.name}`, () => {
                    void run(async () => {
                      await controller.mute(user.id);
                      await meetingApi
                        .audit(sessionId, 'mute_participant', user.name)
                        .catch(() => {});
                    });
                  })}
                {controller.self?.host && !user.host && user.id !== state.selfId && (
                  <>
                    {controller.settings.cohosts?.enabled &&
                      button(
                        `${user.cohost ? 'Remove co-host' : 'Make co-host'} ${user.name}`,
                        () => {
                          void run(() => controller.cohost(user.id, !user.cohost));
                        },
                      )}
                    {button(`Make host ${user.name}`, () =>
                      showAlert('Transfer host?', `${user.name} will become the host.`, [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Transfer',
                          onPress: () => {
                            void run(() => controller.transferHost(user.id));
                          },
                        },
                      ]),
                    )}
                  </>
                )}
              </NativeParticipantRow>
            ))}
          </View>
        </ScrollView>
      </NativeMeetingSheet>
      <NativeInvitationSheet
        open={inClass && invitationOpen && controller.settings.invite.enabled}
        onClose={() => setInvitationOpen(false)}
        title={title ?? 'Live class'}
        link={credentials.sharePath ?? ''}
        passcode={credentials.meetingPasscode}
      />
      <NativeChatSheet
        open={inClass && panel === 'chat'}
        messages={state.messages}
        canSend={controller.settings.messages.enabled && state.chatAllowed}
        blockedReason={state.chatAllowed ? undefined : 'The host has turned off chat.'}
        onSend={(message) => controller.chat(message)}
        onClose={() => setPanel('none')}
      />
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
  const toggleParticipantAnnotations = () => {
    if (!moderator || !shareContext || !state.sharingUserId) return;
    void run(async () => {
      const api = nativeAnnotationApi(
        sessionId,
        state.sharingUserId!,
        credentials.annotationToken,
      );
      await api.save(shareContext.snapshot.roomId, {
        eventId: generateClientMessageId(),
        kind: 'permissions',
        enabled: !shareContext.snapshot.studentsEnabled,
      });
      setShareContext(await api.load());
    });
  };
  const presentationControls = (expanded = false) => (
    <NativePresentationControls
      onFullscreen={
        otherSharing
          ? () =>
              setFocused(expanded ? null : { id: state.sharingUserId!, sharing: true })
          : undefined
      }
      expanded={expanded}
      annotationsEnabled={shareContext?.snapshot.studentsEnabled}
      onToggleAnnotations={
        moderator && shareContext ? toggleParticipantAnnotations : undefined
      }
    />
  );
  const focusedVideo = (
    <NativeFocusedVideo
      user={state.participants.find((user) => user.id === focused?.id)}
      sharing={focused?.sharing ?? false}
      shareContent={
        focused?.sharing
          ? (contentHeight) => (
              <NativeShareStage
                sessionId={sessionId}
                userId={focused.id}
                token={credentials.annotationToken}
                height={contentHeight}
                annotating={annotating}
                onToggleAnnotation={() => setAnnotating((value) => !value)}
                composited={state.composited.includes(focused.id)}
                publishAnnotations={false}
                controls={presentationControls(true)}
                onContext={rememberAnnotations}
              />
            )
          : undefined
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
            {selfSharing && (
              <NativeSharingNotice
                whiteboard={boardPublishing.current}
                onStop={stopSharing}
              />
            )}
            {state.network === 'bad' && (
              <NativeConnectionHelp
                cameraOn={state.camera}
                onCameraOff={() => {
                  void run(() => controller.camera(false));
                }}
              />
            )}
            {(error || state.error) && (
              <NativeClassroomError message={(error ?? state.error)!} />
            )}
            {state.phase === 'reconnecting' && (
              <Text accessibilityRole="alert" style={{ color: colors.text }}>
                Reconnecting to the classroom…
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
          </View>
          <View style={{ flex: 1, paddingHorizontal: 12, gap: 8 }}>
            {!boardVisible && state.sharingUserIds.length > 1 && (
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
            <View
              testID={
                landscape && hasPresentation
                  ? 'presentation-landscape'
                  : 'presentation-portrait'
              }
              style={{
                flex: 1,
                flexDirection: landscape && hasPresentation ? 'row' : 'column',
                gap: 8,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                {whiteboardStage}
                {!boardVisible &&
                  (state.sharingUserId ? (
                    <View
                      style={{ flex: 1 }}
                      onLayout={(event) =>
                        setStageHeight(event.nativeEvent.layout.height)
                      }
                    >
                      {otherSharing && focused?.id !== state.sharingUserId ? (
                        <NativeShareStage
                          sessionId={sessionId}
                          onContext={rememberAnnotations}
                          userId={state.sharingUserId}
                          token={credentials.annotationToken}
                          height={stageHeight}
                          annotating={annotating}
                          onToggleAnnotation={() => setAnnotating((value) => !value)}
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
                            Switch to the app or document you want to present. Everything
                            visible on your device is shared.
                          </Text>
                        </View>
                      ) : null}
                      {presentationControls()}
                    </View>
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
                  ))}
              </View>
              {hasPresentation && (
                <NativeParticipantFilmstrip
                  vertical={landscape}
                  participants={stageParticipants}
                  selfId={state.selfId}
                  speaking={state.speaking}
                  raisedHands={state.raisedHands}
                  reactionFor={reactionFor}
                  onFocus={(id) => setFocused({ id, sharing: false })}
                />
              )}
            </View>
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
            <NativeMeetingToolbar
              more={
                <NativeHandAndReactions
                  raised={state.raisedHands.includes(state.selfId ?? '')}
                  onHand={() => {
                    void run(() =>
                      controller.raiseHand(
                        !state.raisedHands.includes(state.selfId ?? ''),
                      ),
                    );
                  }}
                  onReact={(emoji) => {
                    void run(() => controller.react(emoji));
                  }}
                />
              }
            >
              {button(state.microphone ? 'Mute microphone' : 'Unmute microphone', () => {
                void run(() => controller.microphone(!state.microphone));
              })}
              {button('Settings', () => {
                setSettingsTab('audio');
                setPanel('audio');
              })}
              {button(state.camera ? 'Stop video' : 'Start video', () => {
                void run(() => controller.camera(!state.camera));
              })}
              {hostEligible &&
                !controller.self?.host &&
                button('Claim host', () =>
                  showAlert(
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
                  !pip.canEnter,
                )}
              {button(
                selfSharing && !boardPublishing.current
                  ? 'Stop sharing screen'
                  : 'Share screen',
                () => {
                  if (boardActive || zoomBoardActive) return;
                  void run(() => controller.share(!selfSharing));
                },
                boardActive || zoomBoardActive,
              )}
              {controller.settings.whiteboard.enabled &&
                button(
                  'Whiteboard',
                  () => {
                    void run(async () => {
                      if (
                        state.sharingUserIds.length > 0 &&
                        !boardActive &&
                        !zoomBoardActive
                      )
                        throw new Error(
                          'Stop screen sharing before starting a whiteboard.',
                        );
                      const access = credentials.whiteboard;
                      if (access?.provider !== 'excalidraw' || !access.token) {
                        setPanel('whiteboard');
                        return;
                      }
                      const snapshot = whiteboardRepository
                        ? await whiteboardRepository.load()
                        : await capabilityGet<WhiteboardSnapshotVM>(
                            '/whiteboards/current',
                            access.token,
                          );
                      if (snapshot.presentationActive) {
                        const ownsPresentation =
                          !!snapshot.actorId &&
                          snapshot.actorId ===
                            snapshot.document.presentation?.presenterId;
                        showAlert('Whiteboard', 'Manage your whiteboard view.', [
                          {
                            text: boardVisible
                              ? 'Hide whiteboard for me'
                              : 'Show whiteboard',
                            onPress: () => {
                              setBoardVisible(!boardVisible);
                              setBoardExpanded(false);
                            },
                          },
                          ...(ownsPresentation
                            ? [
                                {
                                  text: 'Stop sharing for everyone',
                                  onPress: () => {
                                    void run(async () => {
                                      const operation = {
                                        id: generateClientMessageId(),
                                        type: 'presentation' as const,
                                        enabled: false,
                                      };
                                      if (whiteboardRepository)
                                        await whiteboardRepository.save(operation);
                                      else
                                        await capabilityPost<WhiteboardSnapshotVM>(
                                          '/whiteboards/current/operations',
                                          access.token!,
                                          operation,
                                        );
                                      onBoardPresentation(false);
                                    });
                                  },
                                },
                              ]
                            : []),
                          { text: 'Cancel', style: 'cancel' },
                        ]);
                        return;
                      }
                      if (!snapshot.presentationActive) {
                        const operation = {
                          id: generateClientMessageId(),
                          type: 'presentation' as const,
                          enabled: true,
                        };
                        if (whiteboardRepository)
                          await whiteboardRepository.save(operation);
                        else
                          await capabilityPost<WhiteboardSnapshotVM>(
                            '/whiteboards/current/operations',
                            access.token,
                            operation,
                          );
                      }
                      setBoardVisible(true);
                    });
                  },
                  state.sharingUserIds.length > 0 && !boardActive && !zoomBoardActive,
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
                button('Invite', () => setInvitationOpen(true))}
              {moderator &&
                controller.settings.recording.enabled &&
                button(
                  recordingPending
                    ? 'Updating recording'
                    : state.recordingPaused
                      ? 'Resume recording'
                      : state.recording
                        ? controller.settings.recording.allowStop
                          ? 'Stop recording'
                          : 'Recording locked'
                        : 'Start recording',
                  () => {
                    void changeRecording(async () => {
                      await controller.recording(
                        state.recordingPaused || !state.recording,
                      );
                    }, state.recordingPaused || !state.recording);
                  },
                  recordingPending ||
                    (state.recording &&
                      !state.recordingPaused &&
                      !controller.settings.recording.allowStop),
                )}
              {moderator &&
                controller.settings.recording.enabled &&
                controller.settings.recording.allowStop &&
                state.recording &&
                !state.recordingPaused &&
                adapter.pauseRecording &&
                button(
                  'Pause recording',
                  () => {
                    void changeRecording(() => controller.pauseRecording(), false);
                  },
                  recordingPending,
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
        {preview && (
          <NativeClassroomHeader
            onBack={() => router.back()}
            disabled={authorizing || state.phase === 'joining'}
          />
        )}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            automaticallyAdjustKeyboardInsets={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 16,
              gap: 16,
              flexGrow: 1,
              justifyContent: preview ? undefined : 'center',
            }}
          >
            {!preview && (
              <Text
                accessibilityRole="header"
                style={{
                  color: colors.text,
                  fontSize: 22,
                  fontWeight: '700',
                  textAlign: 'center',
                }}
              >
                {LEAVE_TITLES[state.leaveReason ?? 'self']}
              </Text>
            )}
            {(error || state.error) && (
              <NativeClassroomError message={(error ?? state.error)!} />
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

            {preview ? (
              <NativeDevicePreview
                displayName={displayName}
                sessionName={title ?? credentials.sessionName}
                camera={state.camera}
                microphone={state.microphone}
                joining={authorizing || state.phase === 'joining'}
                joinDisabled={joinDisabled}
                studentChoices={studentChoices}
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
                onJoin={() => {
                  void join();
                }}
              >
                <View
                  style={{
                    height: width >= 700 ? 270 : 240,
                    borderRadius: 16,
                    overflow: 'hidden',
                    backgroundColor: colors.card,
                  }}
                >
                  {state.phase === 'preview' &&
                  state.camera &&
                  cameraPermission?.granted ? (
                    <NativeVideoView preview userId={null} style={{ flex: 1 }} />
                  ) : state.camera ? (
                    <Text style={{ color: colors.text, padding: 24 }}>
                      Allow camera access to see your preview.
                    </Text>
                  ) : (
                    <NativePreviewAvatar name={displayName} />
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
