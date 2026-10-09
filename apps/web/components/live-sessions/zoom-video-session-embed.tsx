'use client';
import { SpeakingAudioIcon } from '@iconicedu/ui-web/ui/speaking-audio-icon';
import { RecordingContentError } from './zoom-video/meeting-share-compositor';
import { useRecordingShareCompositor } from './zoom-video/use-recording-share-compositor';

import dynamic from 'next/dynamic';
import { useSpeakingParticipants } from './zoom-video/use-speaking-participants';
import { annotationApi } from '../screen-annotations/annotation-api';
import { createShareAnnotationLifecycle } from '../screen-annotations/share-annotation-lifecycle';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChatPrivilege,
  ConnectionState,
  PassiveStopShareReason,
  SharePrivilege,
  VideoQuality,
  WhiteboardStatus,
  RecordingStatus,
} from '@zoom/videosdk';
import {
  Captions,
  Download,
  Hand,
  Loader2,
  MessageSquare,
  MonitorUp,
  MonitorX,
  OctagonX,
  Pencil,
  PictureInPicture2,
  PhoneOff,
  Settings,
  SmilePlus,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';

import {
  DEFAULT_LIVE_SESSION_SETTINGS,
  type LiveSessionSettingsVM,
} from '@iconicedu/shared-types';
import { useMeetingWhiteboard } from '../whiteboard/use-meeting-whiteboard';
import { ClassroomWhiteboard } from '../whiteboard/classroom-whiteboard';
import type { WhiteboardAccessVM } from '@iconicedu/shared-types';
import { useZoomMessagesFeature } from './zoom-video/use-zoom-messages-feature';
import { useZoomRecordingFeature } from './zoom-video/use-zoom-recording-feature';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@iconicedu/ui-web/ui/alert-dialog';
import { clearLiveSessionRecovery } from '@iconicedu/web/lib/live-sessions/browser-session';
import { Popover, PopoverContent, PopoverTrigger } from '@iconicedu/ui-web/ui/popover';
import { cn } from '@iconicedu/ui-web/lib/utils';
import {
  logLiveSessionAuditEvent,
  reportLiveSessionQualityEvent,
  submitLiveSessionFeedback,
} from '@iconicedu/web/lib/live-sessions/public-api';
import {
  acquireZoomClient,
  describeZoomFailure,
  disposeZoomClient,
  dumpZoomFailure,
  initializeAndJoinZoomSession,
  scheduleZoomClientDisposal,
  type ZoomClient,
} from '@iconicedu/web/lib/live-sessions/zoom-session-lifecycle';
import {
  BACKGROUND_PRESETS,
  MIRROR_VIDEO_STORAGE_KEY,
  REACTION_EMOJIS,
} from './zoom-video/zoom-video-session.constants';
import {
  executeZoomCollaborationCommand,
  enableZoomLiveCaptions,
} from '@iconicedu/web/lib/live-sessions/zoom-collaboration';
import { attachCameraTile, detachCameraTile } from './zoom-video/zoom-video-media';
import type {
  AudioProcessingMode,
  BackgroundPreset,
  CommandChannelPayload,
  FloatingReaction,
  MediaDeviceOption,
  NetworkLevel,
  RemoteParticipant,
  SidePanel,
} from './zoom-video/zoom-video-session.types';
import {
  collapseNetworkLevel,
  createFloatingReaction,
  getReactionOrigin,
  parseParticipantCommand,
  shouldUsePresentationLayout,
} from './zoom-video/zoom-video-session.utils';
import { MeetingControlButton, PoppingIcon } from './zoom-video/zoom-meeting-controls';
import { ZoomMeetingNotice } from './zoom-video/zoom-meeting-notice';
import { ZoomMeetingHeader } from './zoom-video/zoom-meeting-header';
import { ZoomMeetingLayoutStyles } from './zoom-video/zoom-meeting-layout-styles';
import {
  ZoomMeetingDockButton,
  ZoomMeetingSideDock,
} from './zoom-video/zoom-meeting-side-dock';
import { ZoomMeetingTimer } from './zoom-video/zoom-meeting-timer';
import { ZoomParticipantGallery } from './zoom-video/zoom-participant-gallery';
import { ZoomFeedbackScreen } from './zoom-video/zoom-feedback-screen';
import { ZoomChatPanel } from './zoom-video/zoom-chat-panel';
import { ZoomParticipantsPanel } from './zoom-video/zoom-participants-panel';
import { ZoomSettingsPanel } from './zoom-video/zoom-settings-panel';
import { ZoomShareStage } from './zoom-video/zoom-share-stage';
import { ZoomShareFilmstrip } from './zoom-video/zoom-share-filmstrip';
import { ZoomMoreControls } from './zoom-video/zoom-more-controls';
import { useMeetingPictureInPicture } from './zoom-video/use-meeting-picture-in-picture';
import {
  MeetingPictureInPictureControls,
  MeetingPipSettings,
  MeetingPipProviders,
} from './zoom-video/meeting-picture-in-picture-controls';
import { ZoomShareMeetingDialog } from './zoom-video/zoom-share-meeting-dialog';

// flag-exempt: repair and complete the existing Video SDK picture-in-picture lifecycle.
// A single shared AudioContext, created lazily on first use — Chrome caps
// how many can exist concurrently, so reuse one for the whole page rather
// than creating a new one per chime.
let joinChimeAudioContext: AudioContext | null = null;

// Short two-note ascending chime (Zoom/Meet-style "someone joined" sound),
// synthesized with the Web Audio API instead of shipping an audio file —
// no asset to source, host, or license for a couple of sine-wave beeps.
// Plays for both the local user joining and any other participant joining.
function playJoinChime() {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }
    const ctx = joinChimeAudioContext ?? new AudioContextCtor();
    joinChimeAudioContext = ctx;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const now = ctx.currentTime;
    const notes: Array<{ freq: number; start: number }> = [
      { freq: 659.25, start: 0 }, // E5
      { freq: 987.77, start: 0.12 }, // B5
    ];
    notes.forEach(({ freq, start }) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = freq;
      oscillator.connect(gain);
      gain.connect(ctx.destination);

      const startTime = now + start;
      const duration = 0.18;
      // Linear ramp up then exponential ramp down avoids the audible
      // "click" a hard on/off would produce.
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      oscillator.start(startTime);
      oscillator.stop(startTime + duration + 0.02);
    });
  } catch {
    // Best effort — a failed chime should never break join/participant flow.
  }
}

const ScreenAnnotationOverlay = dynamic(
  () =>
    import('../screen-annotations/annotation-overlay').then(
      (module) => module.AnnotationOverlay,
    ),
  { ssr: false },
);

export function ZoomVideoSessionEmbed({
  sessionName,
  sessionTitle,
  token,
  displayName,
  initialMuted,
  initialVideoOff,
  onLeave,
  liveSessionId,
  accessToken,
  sessionPasscode,
  settings = DEFAULT_LIVE_SESSION_SETTINGS,
  annotationToken,
  whiteboardAccess,
}: {
  sessionName: string;
  annotationToken?: string;
  whiteboardAccess?: WhiteboardAccessVM;
  sessionTitle?: string;
  token: string;
  displayName: string;
  initialMuted?: boolean;
  initialVideoOff?: boolean;
  onLeave?: () => void;
  // The channel_live_sessions DB row id — distinct from `sessionName` (the
  // Zoom provider's own session/tpc identifier) — used only for the
  // post-session feedback submission below.
  liveSessionId: string;
  accessToken?: string | null;
  sessionPasscode?: string | null;
  settings?: LiveSessionSettingsVM;
}) {
  const clientRef = useRef<ZoomClient | null>(null);
  const selfUserIdRef = useRef<number | null>(null);
  const activeShareUserIdRef = useRef<number | null>(null);
  const remoteParticipantsRef = useRef<RemoteParticipant[]>([]);
  const reactionOverlayRef = useRef<HTMLDivElement | null>(null);
  const selfVideoRef = useRef<HTMLDivElement | null>(null);
  const remoteVideoRefs = useRef(new Map<number, HTMLDivElement>());
  // flag-exempt: correct the origin of the existing reaction animation.
  const createParticipantReaction = useCallback((emoji: string, userId: number) => {
    const tile =
      userId === selfUserIdRef.current
        ? selfVideoRef.current
        : remoteVideoRefs.current.get(userId);
    const overlay = reactionOverlayRef.current;
    if (!tile || !overlay) return null;
    const tileRect = tile.getBoundingClientRect();
    if (tileRect.width === 0 || tileRect.height === 0) return null;
    return createFloatingReaction(
      emoji,
      getReactionOrigin(tileRect, overlay.getBoundingClientRect()),
    );
  }, []);

  const shareCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const localShareCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const localShareVideoRef = useRef<HTMLVideoElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const isLeavingRef = useRef(false);
  const isHandRaisedRef = useRef(false);

  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>(
    'connecting',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [localShareRenderTarget, setLocalShareRenderTarget] = useState<
    'canvas' | 'video'
  >('canvas');
  const [shareError, setShareError] = useState<string | null>(null);
  const [annotationLifecycle] = useState(() =>
    createShareAnnotationLifecycle(annotationApi().apply),
  );
  const endShareAnnotations = useCallback(
    (userId: number | null) => {
      if (userId === null) return;
      void annotationLifecycle
        .end(String(userId))
        .catch(() =>
          setShareError('Unable to close annotations for the ended screen share.'),
        );
    },
    [annotationLifecycle],
  );

  const [showPipSettings, setShowPipSettings] = useState(false);
  const [activeShareUserId, setActiveShareUserId] = useState<number | null>(null);
  const [sharePresenters, setSharePresenters] = useState<
    Array<{ userId: number; displayName: string }>
  >([]);
  const [shareContentDimensions, setShareContentDimensions] = useState({
    width: 16,
    height: 9,
  });
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [selfAvatar, setSelfAvatar] = useState<string | undefined>();
  const speakingUserIds = useSpeakingParticipants(
    clientRef.current,
    status === 'connected',
    selfUserIdRef.current,
    isMuted,
  );
  const [activeSpeakerUserId, setActiveSpeakerUserId] = useState<number | null>(null);
  const [galleryPage, setGalleryPage] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [raisedHandUserIds, setRaisedHandUserIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [participantReactions, setParticipantReactions] = useState<
    Record<number, { id: string; emoji: string }>
  >({});
  const showParticipantReaction = useCallback(
    (emoji: string, userId: number) => {
      const reaction = createParticipantReaction(emoji, userId);
      const id = reaction?.id ?? `${Date.now()}-${Math.random()}`;
      setParticipantReactions((previous) => ({ ...previous, [userId]: { id, emoji } }));
      if (reaction) setFloatingReactions((previous) => [...previous, reaction]);
      setTimeout(() => {
        setFloatingReactions((previous) => previous.filter((item) => item.id !== id));
        setParticipantReactions((previous) => {
          if (previous[userId]?.id !== id) return previous;
          const next = { ...previous };
          delete next[userId];
          return next;
        });
      }, reaction?.durationMs ?? 3000);
    },
    [createParticipantReaction],
  );

  // Uplink and downlink arrive as separate events, tracked separately so a
  // later improvement on one direction isn't permanently masked by an older
  // bad reading on the other — the displayed/reported level is the worse of
  // whatever the two most-recently-reported values currently are.
  const [, setNetworkQualityByUserId] = useState<
    Record<number, { uplink: NetworkLevel; downlink: NetworkLevel }>
  >({});
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Connected,
  );
  const [isCaptionsOn, setIsCaptionsOn] = useState(false);
  const [captionsError, setCaptionsError] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState('');
  const [showEndForAllConfirm, setShowEndForAllConfirm] = useState(false);
  const lastReportedQualityLevelRef = useRef<NetworkLevel | null>(null);
  const captionClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isSelfHost, setIsSelfHost] = useState(false);
  const prepareRecordingRef = useRef<() => Promise<void>>(async () => {});
  const boardPublicationRef = useRef(false);
  const recording = useZoomRecordingFeature(
    status === 'connected' ? clientRef.current : null,
    isSelfHost,
    settings.recording,
    () => prepareRecordingRef.current(),
  );
  const recordingStatus = recording.status;
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const [hasLeft, setHasLeft] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [activePanel, setActivePanel] = useState<SidePanel>(null);
  const messages = useZoomMessagesFeature(
    status === 'connected' ? clientRef.current : null,
    settings.messages,
    activePanel === 'chat',
    displayName,
  );
  const {
    messages: chatMessages,
    draft: chatDraft,
    setDraft: setChatDraft,
    unreadCount: unreadChatCount,
  } = messages;
  const [cameraList, setCameraList] = useState<MediaDeviceOption[]>([]);
  const [micList, setMicList] = useState<MediaDeviceOption[]>([]);
  const [speakerList, setSpeakerList] = useState<MediaDeviceOption[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [activeMicId, setActiveMicId] = useState<string | null>(null);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [supportsVirtualBackground, setSupportsVirtualBackground] = useState(false);
  const [supportsScreenShare, setSupportsScreenShare] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [sessionEndMessage, setSessionEndMessage] = useState<string | null>(null);
  const [backgroundPreset, setBackgroundPreset] = useState<BackgroundPreset>('none');
  const [isMirrored, setIsMirrored] = useState(() => {
    try {
      return localStorage.getItem(MIRROR_VIDEO_STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const isMirroredRef = useRef(isMirrored);
  const [supportsNoiseSuppression, setSupportsNoiseSuppression] = useState(false);
  const [audioProcessing, setAudioProcessing] =
    useState<AudioProcessingMode>('noiseSuppression');
  // Matches Zoom's own default (the regular client's Share Screen Settings
  // defaults to "Multiple participants can share simultaneously").
  const [sharePrivilege, setSharePrivilege] = useState<SharePrivilege>(
    SharePrivilege.MultipleShare,
  );
  const [hwAccelEncode, setHwAccelEncode] = useState(true);
  const [hwAccelDecode, setHwAccelDecode] = useState(true);
  const whiteboard = useMeetingWhiteboard(
    status === 'connected' ? clientRef.current : null,
    settings.whiteboard.enabled,
    sessionName,
    activeShareUserId,
    whiteboardAccess,
  );
  const {
    containerRef: whiteboardContainerRef,
    status: whiteboardStatus,
    presenting: isPresentingWhiteboard,
    supported: supportsWhiteboard,
    error: whiteboardError,
    toggle: toggleWhiteboardContent,
    exportPdf: exportWhiteboardPdf,
  } = whiteboard;
  const pauseRecordingForContentFailure = useCallback(() => {
    if (!isSelfHost || recordingStatus !== RecordingStatus.Recording) return;
    const recordingClient = clientRef.current?.getRecordingClient();
    if (recordingClient)
      void recordingClient
        .pauseCloudRecording()
        .then((result) => {
          if (result !== '')
            setShareError(
              'Shared content could not be captured and recording could not be paused. Stop recording and retry.',
            );
        })
        .catch(() =>
          setShareError(
            'Unable to pause recording. Stop recording and retry shared content capture.',
          ),
        );
  }, [isSelfHost, recordingStatus]);
  const recordingComposition = useRecordingShareCompositor(
    status === 'connected' && !showFeedbackPrompt ? clientRef.current : null,
    isSharingScreen,
    () => {
      if (boardPublicationRef.current) {
        const root = whiteboardContainerRef.current?.querySelector<HTMLElement>(
          '[data-recording-whiteboard]',
        );
        return root ? { root, mode: 'whiteboard' } : null;
      }
      const root = localShareCanvasRef.current?.parentElement?.querySelector<HTMLElement>(
        '[data-recording-annotations]',
      );
      return root ? { root, mode: 'annotations' } : null;
    },
    pauseRecordingForContentFailure,
    activeShareUserId,
  );
  const publishWhiteboardForRecording = async () => {
    const client = clientRef.current;
    if (!client || !localShareVideoRef.current || !localShareCanvasRef.current)
      throw new RecordingContentError(
        'Recording content is not ready. Retry after joining.',
      );
    boardPublicationRef.current = true;
    recordingComposition.setMode('whiteboard');
    try {
      await recordingComposition.prepare();
      const stream = client.getMediaStream();
      if (!isSharingScreen) {
        const video = stream.isStartShareScreenWithVideoElement();
        setLocalShareRenderTarget(video ? 'video' : 'canvas');
        const result = await stream.startShareScreen(
          video ? localShareVideoRef.current : localShareCanvasRef.current,
          {
            displaySurface: 'browser',
            hideShareAudioOption: true,
            controls: {
              preferCurrentTab: true,
              selfBrowserSurface: 'include',
              systemAudio: 'exclude',
            },
          },
        );
        if (result !== '')
          throw new RecordingContentError(
            'Whiteboard sharing could not start. Confirm the browser sharing prompt and retry.',
          );
        setIsSharingScreen(true);
      }
    } catch (error) {
      boardPublicationRef.current = false;
      const stream = client.getMediaStream();
      if (
        !isSharingScreen &&
        stream.getShareUserList().some((user) => user.userId === selfUserIdRef.current)
      ) {
        await stream.stopShareScreen().catch(() => {});
        setIsSharingScreen(false);
      }
      recordingComposition.setMode('annotations');
      throw error instanceof RecordingContentError
        ? error
        : new RecordingContentError(
            'Whiteboard was not shared. Confirm the browser sharing prompt and retry recording.',
          );
    }
  };
  prepareRecordingRef.current = async () => {
    if (whiteboard.nativeToken && whiteboardStatus !== WhiteboardStatus.Closed) {
      await publishWhiteboardForRecording();
    } else if (isSharingScreen) {
      await recordingComposition.prepare();
    } else if (activeShareUserId !== null) {
      await recordingComposition.ensurePresenter(activeShareUserId);
    }
  };
  const toggleWhiteboard = async () => {
    try {
      const opening = whiteboardStatus === WhiteboardStatus.Closed;
      if (
        opening &&
        whiteboard.nativeToken &&
        isSelfHost &&
        recordingStatus === RecordingStatus.Recording
      )
        await publishWhiteboardForRecording();
      await toggleWhiteboardContent();
      if (!opening && boardPublicationRef.current) {
        await clientRef.current?.getMediaStream().stopShareScreen();
        boardPublicationRef.current = false;
        recordingComposition.setMode('annotations');
        setIsSharingScreen(false);
      }
    } catch (error) {
      setShareError(
        error instanceof Error
          ? error.message
          : 'Unable to publish whiteboard content for recording.',
      );
    }
  };
  useEffect(() => {
    if (
      isSelfHost &&
      boardPublicationRef.current &&
      !isSharingScreen &&
      whiteboardStatus !== WhiteboardStatus.Closed &&
      recordingStatus === RecordingStatus.Recording
    ) {
      setShareError(
        'Whiteboard sharing stopped. Resume recording and confirm browser sharing to include the board again.',
      );
      pauseRecordingForContentFailure();
    }
  }, [
    isSelfHost,
    isSharingScreen,
    whiteboardStatus,
    recordingStatus,
    pauseRecordingForContentFailure,
  ]);
  useEffect(() => {
    if (
      isSelfHost &&
      whiteboard.nativeToken &&
      whiteboardStatus !== WhiteboardStatus.Closed &&
      !boardPublicationRef.current &&
      recordingStatus === RecordingStatus.Recording
    ) {
      setShareError(
        'The whiteboard needs browser sharing confirmation to appear in this cloud recording. Resume recording to include it.',
      );
      pauseRecordingForContentFailure();
    }
  }, [
    isSelfHost,
    whiteboard.nativeToken,
    whiteboardStatus,
    recordingStatus,
    pauseRecordingForContentFailure,
  ]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);

  const updateRemoteParticipants = useCallback(
    (update: (previous: RemoteParticipant[]) => RemoteParticipant[]) => {
      setRemoteParticipants((previous) => {
        const next = update(previous);
        remoteParticipantsRef.current = next;
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    if (status !== 'connected') {
      return;
    }
    const interval = setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight });
  }, [chatMessages, activePanel]);

  // Video tiles move between different DOM containers whenever the layout
  // changes — switching speaker/side-by-side, a share or whiteboard taking
  // over the main slot, or the other participant joining/leaving (which
  // also moves self between the main slot and the corner PiP, see
  // isAloneInSpeakerView). The previously-attached <video-player> element
  // unmounts along with its old container, so without this it just goes
  // blank until some unrelated peer-video-state-change event happens to
  // fire next — re-attach into whichever container is current instead.
  useEffect(() => {
    const client = clientRef.current;
    if (!client || status !== 'connected') {
      return;
    }
    const selfId = selfUserIdRef.current;
    const hasPresentation =
      activeShareUserId !== null ||
      isSharingScreen ||
      whiteboardStatus !== WhiteboardStatus.Closed;
    const selfIsThumbnail = hasPresentation;
    const participantCount = remoteParticipants.length + 1;
    const galleryQuality =
      participantCount === 1
        ? VideoQuality.Video_720P
        : participantCount >= 10
          ? VideoQuality.Video_180P
          : VideoQuality.Video_360P;
    if (isVideoOn && selfId !== null && selfVideoRef.current) {
      void attachCameraTile(
        client,
        selfId,
        selfVideoRef.current,
        selfIsThumbnail ? VideoQuality.Video_180P : galleryQuality,
      );
    }
    remoteParticipants.forEach((participant) => {
      const container = remoteVideoRefs.current.get(participant.userId);
      if (!participant.bVideoOn || !container) return;
      void attachCameraTile(
        client,
        participant.userId,
        container,
        hasPresentation ? VideoQuality.Video_180P : galleryQuality,
      );
    });
  }, [
    status,
    activeShareUserId,
    isSharingScreen,
    whiteboardStatus,
    remoteParticipants,
    isVideoOn,
    galleryPage,
  ]);

  useEffect(() => {
    let cancelled = false;
    const client = acquireZoomClient();
    clientRef.current = client;

    const refreshDeviceLists = () => {
      const stream = client.getMediaStream();
      const cameras = stream.getCameraList();
      const mics = stream.getMicList();
      const speakers = stream.getSpeakerList();
      setCameraList(cameras);
      setMicList(mics);
      setSpeakerList(speakers);

      // getActive*() can return '' (nothing captured yet) or 'default' (no
      // explicit device ID — using whatever the system default is) instead
      // of a real deviceId that matches an entry in the list above, which is
      // why the Select was showing its placeholder instead of a selection.
      // Falling back to the first listed device for either case is the same
      // thing the browser/SDK would actually be using as "default" anyway.
      const activeCamera = stream.getActiveCamera();
      setActiveCameraId(
        cameras.some((device) => device.deviceId === activeCamera)
          ? activeCamera
          : (cameras[0]?.deviceId ?? null),
      );
      const activeMic = stream.getActiveMicrophone();
      setActiveMicId(
        mics.some((device) => device.deviceId === activeMic)
          ? activeMic
          : (mics[0]?.deviceId ?? null),
      );
      const activeSpeaker = stream.getActiveSpeaker();
      setActiveSpeakerId(
        speakers.some((device) => device.deviceId === activeSpeaker)
          ? activeSpeaker
          : (speakers[0]?.deviceId ?? null),
      );
    };

    const handleUserAdded = (
      payload: Array<{ userId: number; displayName: string; avatar?: string }>,
    ) => {
      const selfId = selfUserIdRef.current;
      // 'user-added' can fire for our own join before client.join() resolves
      // (selfUserIdRef isn't set yet) — without this guard, `userId !== null`
      // is true for every real ID, including our own, so our own join event
      // gets misread as a second participant and the count shows 2 when
      // you're alone. Anyone genuinely already in the session is instead
      // picked up by the explicit getAllUser() reconciliation right after
      // join() resolves below, so it's safe to just ignore this until then.
      if (selfId === null) {
        return;
      }
      const added = payload.filter((user) => user.userId !== selfId);
      if (added.length) {
        updateRemoteParticipants((previous) => [
          ...previous,
          ...added
            .filter((candidate) =>
              previous.every((participant) => participant.userId !== candidate.userId),
            )
            .map((candidate) => ({
              userId: candidate.userId,
              displayName: candidate.displayName,
              avatar: candidate.avatar,
              muted: false,
              bVideoOn: false,
              isHost: false,
            })),
        ]);
        playJoinChime();
      }
    };

    const handleUserRemoved = (payload: Array<{ userId: number }>) => {
      const removedIds = new Set(payload.map((user) => user.userId));
      removedIds.forEach((userId) => {
        remoteVideoRefs.current.get(userId)?.replaceChildren();
        remoteVideoRefs.current.delete(userId);
      });
      updateRemoteParticipants((previous) =>
        previous.filter((participant) => !removedIds.has(participant.userId)),
      );
      setRaisedHandUserIds((previous) => {
        const next = new Set(previous);
        removedIds.forEach((userId) => next.delete(userId));
        return next;
      });
      setActiveSpeakerUserId((userId) =>
        userId !== null && removedIds.has(userId) ? null : userId,
      );
    };

    const handleUserUpdated = (
      payload: Array<{
        userId: number;
        displayName?: string;
        avatar?: string;
        muted?: boolean;
        bVideoOn?: boolean;
        isHost?: boolean;
      }>,
    ) => {
      const updates = new Map(payload.map((user) => [user.userId, user]));
      const selfUpdate = updates.get(selfUserIdRef.current ?? -1);
      if (typeof selfUpdate?.isHost === 'boolean') setIsSelfHost(selfUpdate.isHost);
      updateRemoteParticipants((previous) =>
        previous.map((participant) => {
          const update = updates.get(participant.userId);
          return update
            ? {
                ...participant,
                displayName: update.displayName ?? participant.displayName,
                avatar: update.avatar ?? participant.avatar,
                muted: update.muted ?? participant.muted,
                bVideoOn: update.bVideoOn ?? participant.bVideoOn,
                isHost: update.isHost ?? participant.isHost,
              }
            : participant;
        }),
      );
    };

    const handlePeerVideoStateChange = (payload: {
      action: 'Start' | 'Stop';
      userId: number;
    }) => {
      const selfId = selfUserIdRef.current;
      const isSelf = payload.userId === selfId;
      const container = isSelf
        ? selfVideoRef.current
        : remoteVideoRefs.current.get(payload.userId);
      if (container) {
        if (payload.action === 'Start') {
          void attachCameraTile(client, payload.userId, container);
        } else {
          void detachCameraTile(client, payload.userId, container);
        }
      }
      if (isSelf) {
        setIsVideoOn(payload.action === 'Start');
      } else {
        updateRemoteParticipants((previous) =>
          previous.map((participant) =>
            participant.userId === payload.userId
              ? { ...participant, bVideoOn: payload.action === 'Start' }
              : participant,
          ),
        );
      }
    };

    const handleActiveSpeaker = (payload: Array<{ userId: number }>) => {
      setActiveSpeakerUserId(payload[0]?.userId ?? null);
    };

    const handleActiveShareChange = (payload: {
      state: 'Active' | 'Inactive';
      userId: number;
    }) => {
      const selfId = selfUserIdRef.current;
      if (payload.state === 'Active') {
        activeShareUserIdRef.current = payload.userId;
        setActiveShareUserId(payload.userId);
        if (payload.userId !== selfId && shareCanvasRef.current) {
          void client
            .getMediaStream()
            .startShareView(shareCanvasRef.current, payload.userId);
        }
      } else {
        activeShareUserIdRef.current = null;
        setActiveShareUserId(null);
        if (payload.userId !== selfId) {
          void client
            .getMediaStream()
            .stopShareView()
            .catch(() => null);
        }
      }
    };

    const syncSharePresenters = () => {
      const presenters = client
        .getMediaStream()
        .getShareUserList()
        .map((participant) => ({
          userId: participant.userId,
          displayName: participant.displayName,
        }));
      setSharePresenters(presenters);
      return presenters;
    };

    const handlePeerShareStateChange = (payload: {
      action: 'Start' | 'Stop';
      userId: number;
    }) => {
      if (payload.action === 'Stop') endShareAnnotations(payload.userId);
      // Let the SDK update getShareUserList() before reading the new snapshot.
      setTimeout(() => {
        const presenters = syncSharePresenters();
        if (
          payload.action === 'Stop' &&
          activeShareUserIdRef.current === null &&
          presenters.length > 0
        ) {
          void client.getMediaStream().switchShareView(presenters[0].userId);
        }
      }, 0);
    };

    const handleShareContentDimensionChange = (payload: {
      type: 'sended' | 'received';
      width: number;
      height: number;
    }) => {
      if (payload.width > 0 && payload.height > 0) {
        setShareContentDimensions({ width: payload.width, height: payload.height });
      }
    };

    // Fires when sharing stops for a reason other than our own
    // stopShareScreen() call — the browser's native "Stop sharing" bar, or
    // the share privilege changing out from under us. Without this,
    // isSharingScreen stays stuck true and the "Stop sharing" banner lingers
    // even though the share has actually already ended.
    const handlePassivelyStopShare = (reason: PassiveStopShareReason) => {
      endShareAnnotations(selfUserIdRef.current);
      setIsSharingScreen(false);
      if (reason === PassiveStopShareReason.PrivilegeChange) {
        setShareError(
          'Your screen share was stopped because sharing privileges changed.',
        );
      }
    };

    // Keeps the Settings UI in sync if a host/manager changes who's allowed
    // to share from elsewhere (e.g. a second host, or this same control on
    // another of their devices).
    const handleSharePrivilegeChange = (payload: { privilege: SharePrivilege }) => {
      setSharePrivilege(payload.privilege);
    };

    const handleDeviceChange = () => refreshDeviceLists();

    const handleNetworkQualityChange = (payload: {
      userId: number;
      type: 'uplink' | 'downlink';
      level: number;
    }) => {
      const level = collapseNetworkLevel(payload.level);
      setNetworkQualityByUserId((previous) => {
        const existing = previous[payload.userId] ?? { uplink: 'good', downlink: 'good' };
        if (existing[payload.type] === level) {
          return previous;
        }
        return {
          ...previous,
          [payload.userId]: { ...existing, [payload.type]: level },
        };
      });

      // Only report our OWN connection's degraded transitions to the
      // backend — each client reports for itself, rather than every
      // observer separately reporting what they see of a peer, which would
      // duplicate and could conflict across participants.
      if (payload.userId !== selfUserIdRef.current) {
        return;
      }
      if (level !== 'bad' && level !== 'good') {
        return;
      }
      if (lastReportedQualityLevelRef.current === level) {
        return;
      }
      lastReportedQualityLevelRef.current = level;
      void reportLiveSessionQualityEvent(
        liveSessionId,
        {
          displayName,
          metric: 'network_quality',
          level,
          occurredAt: new Date().toISOString(),
        },
        accessToken,
      );
    };

    const handleConnectionChange = (payload: {
      state: ConnectionState;
      reason?: string;
      errorCode?: number;
    }) => {
      setConnectionState(payload.state);
      if (isLeavingRef.current) {
        return;
      }
      if (payload.state === ConnectionState.Closed) {
        setSessionEndMessage(
          payload.reason
            ? `The class ended (${payload.reason}).`
            : 'The class has ended or you were disconnected.',
        );
      } else if (payload.state === ConnectionState.Fail) {
        setSessionEndMessage(
          payload.errorCode
            ? `The connection failed (error ${payload.errorCode}). Please rejoin the class.`
            : 'The connection failed. Please rejoin the class.',
        );
      } else if (payload.state === ConnectionState.Connected) {
        setSessionEndMessage(null);
      }
      if (
        payload.state === ConnectionState.Reconnecting ||
        payload.state === ConnectionState.Fail
      ) {
        void reportLiveSessionQualityEvent(
          liveSessionId,
          {
            displayName,
            metric: 'connection_state',
            level: payload.state === ConnectionState.Fail ? 'fail' : 'reconnecting',
            occurredAt: new Date().toISOString(),
          },
          accessToken,
        );
      }
    };

    const handleDevicePermissionChange = (payload: {
      name: 'microphone' | 'camera';
      state: 'denied' | 'granted' | 'prompt';
    }) => {
      if (payload.state === 'denied') {
        setMediaError(
          `${payload.name === 'camera' ? 'Camera' : 'Microphone'} access is blocked. Allow access in your browser settings, then refresh.`,
        );
      } else if (payload.state === 'granted') {
        setMediaError(null);
      }
    };

    const handleActiveMediaFailed = (payload: {
      code: number;
      message: string;
      type: 'audio' | 'video' | 'sharing';
    }) => {
      setMediaError(
        `${payload.type === 'audio' ? 'Audio' : payload.type === 'video' ? 'Video' : 'Screen sharing'} stopped unexpectedly. ${payload.message || 'Refresh to reconnect your media.'}`,
      );
    };

    const handleCommandChannelMessage = (payload: { senderId: string; text: string }) => {
      const command = parseParticipantCommand(payload.senderId, payload.text);
      if (!command || command.userId === selfUserIdRef.current) return;
      const { userId, payload: parsed } = command;
      if (parsed.type === 'raise-hand') {
        setRaisedHandUserIds((previous) => {
          const next = new Set(previous);
          if (parsed.raised) next.add(userId);
          else next.delete(userId);
          return next;
        });
        return;
      }
      if (parsed.type === 'raise-hand-state-request' && isHandRaisedRef.current) {
        void client.getCommandClient().send(
          JSON.stringify({
            type: 'raise-hand',
            raised: true,
          } satisfies CommandChannelPayload),
        );
        return;
      }
      if (parsed.type === 'reaction') {
        showParticipantReaction(parsed.emoji, userId);
      }
    };

    const handleCaptionMessage = (payload: { text: string }) => {
      setCaptionText(payload.text);
      if (captionClearTimerRef.current) {
        clearTimeout(captionClearTimerRef.current);
      }
      captionClearTimerRef.current = setTimeout(() => setCaptionText(''), 6000);
    };

    client.on('user-added', handleUserAdded);
    client.on('user-removed', handleUserRemoved);
    client.on('user-updated', handleUserUpdated);
    client.on('peer-video-state-change', handlePeerVideoStateChange);
    client.on('active-speaker', handleActiveSpeaker);
    client.on('active-share-change', handleActiveShareChange);
    client.on('peer-share-state-change', handlePeerShareStateChange);
    client.on('share-content-dimension-change', handleShareContentDimensionChange);
    client.on('passively-stop-share', handlePassivelyStopShare);
    client.on('share-privilege-change', handleSharePrivilegeChange);
    client.on('device-change', handleDeviceChange);
    client.on('network-quality-change', handleNetworkQualityChange);
    client.on('connection-change', handleConnectionChange);
    client.on('device-permission-change', handleDevicePermissionChange);
    client.on('active-media-failed', handleActiveMediaFailed);
    client.on('command-channel-message', handleCommandChannelMessage);
    client.on('caption-message', handleCaptionMessage);

    async function connect() {
      try {
        const { compatibility, self } = await initializeAndJoinZoomSession(client, {
          sessionName,
          token,
          displayName,
        });
        setSupportsScreenShare(compatibility.screen);
        if (cancelled) {
          return;
        }
        selfUserIdRef.current = self.userId;
        setSelfAvatar(self.avatar);
        setIsSelfHost(self.isHost);
        if (self.isHost && (!settings.messages.visible || !settings.messages.enabled)) {
          await executeZoomCollaborationCommand(() =>
            client.getChatClient().setPrivilege(ChatPrivilege.NoOne),
          );
        }
        setStatus('connected');
        syncSharePresenters();
        playJoinChime();

        const existingRemoteParticipants = client
          .getAllUser()
          .filter((user) => user.userId !== self.userId)
          .map((user) => ({
            userId: user.userId,
            displayName: user.displayName,
            avatar: user.avatar,
            muted: user.muted ?? false,
            bVideoOn: user.bVideoOn,
            isHost: user.isHost,
          }));
        updateRemoteParticipants(() => existingRemoteParticipants);

        // Command-channel messages are ephemeral. Ask participants to replay
        // their current hand state so someone joining late sees every raised
        // hand instead of only changes made after they arrived.
        void client.getCommandClient().send(
          JSON.stringify({
            type: 'raise-hand-state-request',
          } satisfies CommandChannelPayload),
        );

        const stream = client.getMediaStream();
        refreshDeviceLists();
        setSupportsVirtualBackground(stream.isSupportVirtualBackground());
        setSharePrivilege(stream.getSharePrivilege());
        const noiseSuppressionSupported = stream.isSupportBackgroundNoiseSuppression();
        setSupportsNoiseSuppression(noiseSuppressionSupported);

        await stream.startAudio().catch(() => null);
        refreshDeviceLists();
        if (noiseSuppressionSupported) {
          // Matches Zoom's own default (Background Noise Suppression is
          // pre-selected over Original Sound in the regular Zoom client).
          await stream.enableBackgroundNoiseSuppression(true).catch(() => null);
        }
        if (initialMuted) {
          await stream.muteAudio().catch(() => null);
          setIsMuted(true);
        }

        if (initialVideoOff) {
          setIsVideoOn(false);
        } else {
          try {
            await stream.startVideo();
            setIsVideoOn(true);
            refreshDeviceLists();
            // Don't rely solely on 'peer-video-state-change' for the initial
            // self-attach — "peer" suggests it may only cover other
            // participants. attachCameraTile is idempotent (replaceChildren),
            // so this is harmless if that event also fires for self.
            if (selfVideoRef.current) {
              await attachCameraTile(client, self.userId, selfVideoRef.current);
            }
            // Re-apply the persisted mirror preference once capture starts —
            // mirrorVideo() only takes effect while video is actually on.
            // Read via ref (not the isMirrored state) so this join effect
            // doesn't need to depend on a setting that can change mid-call.
            await stream.mirrorVideo(isMirroredRef.current).catch(() => null);
          } catch {
            setIsVideoOn(false);
          }
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        // eslint-disable-next-line no-console
        console.error('Zoom Video SDK join failed', error);
        setStatus('error');
        setErrorMessage(describeZoomFailure(error));
        setErrorDetail(dumpZoomFailure(error));
      }
    }

    void connect();

    return () => {
      cancelled = true;
      client.off('user-added', handleUserAdded);
      client.off('user-removed', handleUserRemoved);
      client.off('user-updated', handleUserUpdated);
      client.off('peer-video-state-change', handlePeerVideoStateChange);
      client.off('active-speaker', handleActiveSpeaker);
      client.off('active-share-change', handleActiveShareChange);
      client.off('peer-share-state-change', handlePeerShareStateChange);
      client.off('share-content-dimension-change', handleShareContentDimensionChange);
      client.off('passively-stop-share', handlePassivelyStopShare);
      client.off('share-privilege-change', handleSharePrivilegeChange);
      client.off('device-change', handleDeviceChange);
      client.off('network-quality-change', handleNetworkQualityChange);
      client.off('connection-change', handleConnectionChange);
      client.off('device-permission-change', handleDevicePermissionChange);
      client.off('active-media-failed', handleActiveMediaFailed);
      client.off('command-channel-message', handleCommandChannelMessage);
      client.off('caption-message', handleCaptionMessage);
      if (captionClearTimerRef.current) {
        clearTimeout(captionClearTimerRef.current);
      }
      scheduleZoomClientDisposal(client, selfUserIdRef.current);
    };
  }, [
    sessionName,
    token,
    displayName,
    initialMuted,
    initialVideoOff,
    updateRemoteParticipants,
    showParticipantReaction,
    liveSessionId,
    accessToken,
    settings,
    endShareAnnotations,
  ]);

  const toggleMute = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      return;
    }
    const stream = client.getMediaStream();
    if (isMuted) {
      await stream.unmuteAudio().catch(() => null);
    } else {
      await stream.muteAudio().catch(() => null);
    }
    setIsMuted((previous) => !previous);
  }, [isMuted]);

  const toggleVideo = useCallback(async () => {
    const client = clientRef.current;
    const selfId = selfUserIdRef.current;
    if (!client || selfId === null) {
      return;
    }
    const stream = client.getMediaStream();
    const container = selfVideoRef.current;
    if (isVideoOn) {
      // Cover the renderer before the SDK stops delivering camera frames.
      setIsVideoOn(false);
      await stream.stopVideo().catch(() => null);
      if (container) {
        await detachCameraTile(client, selfId, container);
      }
    } else {
      try {
        await stream.startVideo();
        if (container) {
          await attachCameraTile(client, selfId, container);
        }
        setIsVideoOn(true);
      } catch {
        // Camera permission denied or unavailable — stay off.
      }
    }
    // If 'peer-video-state-change' also fires for self, the handler above
    // repeats this same attach/detach — harmless, since both are idempotent.
  }, [isVideoOn]);

  const prepareShareForRecording = recordingComposition.prepare;
  const toggleScreenShare = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !localShareVideoRef.current || !localShareCanvasRef.current) {
      return;
    }
    const stream = client.getMediaStream();
    setShareError(null);
    if (isSharingScreen) {
      await stream.stopShareScreen().catch(() => null);
      endShareAnnotations(selfUserIdRef.current);
      setIsSharingScreen(false);
    } else {
      try {
        const useVideoElement = stream.isStartShareScreenWithVideoElement();
        setLocalShareRenderTarget(useVideoElement ? 'video' : 'canvas');
        const renderTarget = useVideoElement
          ? localShareVideoRef.current
          : localShareCanvasRef.current;
        await prepareShareForRecording(recordingStatus === RecordingStatus.Recording);
        await stream.startShareScreen(renderTarget, {
          // Lets me keep viewing others' shares while my own is active —
          // only meaningful (and only offered) when the host has allowed
          // multiple simultaneous presenters via the Advanced share-privilege
          // setting; otherwise this is a no-op.
          simultaneousShareView: sharePrivilege === SharePrivilege.MultipleShare,
        });
        setIsSharingScreen(true);
        setTimeout(() => {
          setSharePresenters(
            stream.getShareUserList().map((participant) => ({
              userId: participant.userId,
              displayName: participant.displayName,
            })),
          );
        }, 0);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Zoom screen share failed to start', error);
        const message = describeZoomFailure(error);
        // A cancelled browser share picker isn't a real error worth surfacing.
        if (!/cancel|denied|deny/i.test(message)) {
          setShareError(message);
        }
      }
    }
  }, [
    isSharingScreen,
    sharePrivilege,
    endShareAnnotations,
    recordingStatus,
    prepareShareForRecording,
  ]);

  const selectSharedScreen = useCallback(
    async (userId: number) => {
      const client = clientRef.current;
      if (!client || userId === activeShareUserId) return;
      try {
        const result = await client.getMediaStream().switchShareView(userId);
        if (result instanceof Error) throw result;
      } catch (error) {
        setShareError(describeZoomFailure(error));
      }
    },
    [activeShareUserId],
  );

  // Video SDK has no built-in raise-hand API — this broadcasts a small JSON
  // payload over the generic command channel instead (see
  // handleCommandChannelMessage), which is the SDK's own documented
  // mechanism for this kind of custom in-session signaling.
  const toggleHandRaise = useCallback(() => {
    const client = clientRef.current;
    if (!client) {
      return;
    }
    const next = !isHandRaised;
    isHandRaisedRef.current = next;
    setIsHandRaised(next);
    void client.getCommandClient().send(
      JSON.stringify({
        type: 'raise-hand',
        raised: next,
      } satisfies CommandChannelPayload),
    );
  }, [isHandRaised]);

  // Same command-channel approach as raise-hand — Video SDK also has no
  // native emoji-reaction API in this version.
  const sendReaction = useCallback(
    (emoji: string) => {
      const client = clientRef.current;
      if (!client) {
        return;
      }
      showParticipantReaction(emoji, client.getCurrentUserInfo().userId);
      void client
        .getCommandClient()
        .send(
          JSON.stringify({ type: 'reaction', emoji } satisfies CommandChannelPayload),
        );
    },
    [showParticipantReaction],
  );

  const toggleCaptions = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      return;
    }
    setCaptionsError(null);
    const transcriptionClient = client.getLiveTranscriptionClient();
    if (isCaptionsOn) {
      setIsCaptionsOn(false);
      setCaptionText('');
      return;
    }
    try {
      await enableZoomLiveCaptions(
        transcriptionClient,
        client.getCurrentUserInfo().isHost,
      );
      setIsCaptionsOn(true);
    } catch (error) {
      setCaptionsError(describeZoomFailure(error));
    }
  }, [isCaptionsOn]);

  // Teacher-only: force-mutes a student (stream.muteAudio(userId) is a real,
  // previously-unused SDK call — only self-mute existed before this).
  const muteParticipant = useCallback(
    (userId: number, participantDisplayName: string) => {
      const client = clientRef.current;
      if (!client || !isSelfHost) {
        return;
      }
      void client.getMediaStream().muteAudio(userId);
      void logLiveSessionAuditEvent(
        liveSessionId,
        {
          action: 'mute_participant',
          targetDisplayName: participantDisplayName,
          occurredAt: new Date().toISOString(),
        },
        accessToken,
      );
    },
    [isSelfHost, liveSessionId, accessToken],
  );

  // Host-only "End session for everyone" — distinct from the regular Leave
  // button, which only removes the current user. client.leave(true) is a
  // real SDK call (leave(end?: boolean)) that was previously always invoked
  // with no argument, so it only ever ended the caller's own participation.
  const endSessionForEveryone = useCallback(() => {
    const client = clientRef.current;
    if (!client || !isSelfHost) {
      return;
    }
    void logLiveSessionAuditEvent(
      liveSessionId,
      {
        action: 'end_session_for_all',
        targetDisplayName: null,
        occurredAt: new Date().toISOString(),
      },
      accessToken,
    );
    isLeavingRef.current = true;
    clearLiveSessionRecovery(liveSessionId);
    void disposeZoomClient(client, selfUserIdRef.current, true);
    setShowEndForAllConfirm(false);
    setShowFeedbackPrompt(true);
  }, [isSelfHost, liveSessionId, accessToken]);

  const pip = useMeetingPictureInPicture({
    connected: status === 'connected' && !showFeedbackPrompt,
    sharing: isSharingScreen,
    cameraActive: isVideoOn,
    microphoneActive: !isMuted,
  });
  const isPipActive = !!pip.pipWindow;
  const exitPip = pip.restore;
  const enterPip = () => pip.open();

  const selectCamera = useCallback((deviceId: string) => {
    setActiveCameraId(deviceId);
    void clientRef.current
      ?.getMediaStream()
      .switchCamera(deviceId)
      .catch(() => null);
  }, []);

  const selectMicrophone = useCallback((deviceId: string) => {
    setActiveMicId(deviceId);
    void clientRef.current
      ?.getMediaStream()
      .switchMicrophone(deviceId)
      .catch(() => null);
  }, []);

  const selectSpeaker = useCallback((deviceId: string) => {
    setActiveSpeakerId(deviceId);
    void clientRef.current
      ?.getMediaStream()
      .switchSpeaker(deviceId)
      .catch(() => null);
  }, []);

  const selectBackgroundPreset = useCallback(async (preset: BackgroundPreset) => {
    const client = clientRef.current;
    if (!client) {
      return;
    }
    const stream = client.getMediaStream();
    const imageUrl =
      preset === 'none'
        ? undefined
        : preset === 'blur'
          ? 'blur'
          : BACKGROUND_PRESETS.find((item) => item.value === preset)?.src;
    const result = await stream
      .updateVirtualBackgroundImage(imageUrl, true)
      .catch(() => null);
    if (result === null || result instanceof Error) {
      return;
    }
    setBackgroundPreset(preset);
  }, []);

  const toggleMirror = useCallback(
    async (enabled?: boolean) => {
      const client = clientRef.current;
      if (!client) {
        return;
      }
      const next = enabled ?? !isMirrored;
      const result = await client
        .getMediaStream()
        .mirrorVideo(next)
        .catch(() => null);
      if (result === null || result instanceof Error) {
        return;
      }
      isMirroredRef.current = next;
      setIsMirrored(next);
      try {
        localStorage.setItem(MIRROR_VIDEO_STORAGE_KEY, String(next));
      } catch {
        // Private browsing / storage disabled — the preference just won't
        // persist across sessions, which is a harmless degradation.
      }
    },
    [isMirrored],
  );

  const selectAudioProcessing = useCallback(async (mode: AudioProcessingMode) => {
    const client = clientRef.current;
    if (!client) {
      return;
    }
    const stream = client.getMediaStream();
    // originalSound and backgroundNoiseSuppression are mutually exclusive
    // per the SDK docs — set both explicitly rather than relying on one
    // call's side effect to disable the other.
    if (mode === 'original') {
      await stream.enableBackgroundNoiseSuppression(false).catch(() => null);
      await stream.enableOriginalSound(true).catch(() => null);
    } else {
      await stream.enableOriginalSound(false).catch(() => null);
      await stream.enableBackgroundNoiseSuppression(true).catch(() => null);
    }
    setAudioProcessing(mode);
  }, []);

  const toggleHardwareAcceleration = useCallback(
    (kind: 'encode' | 'decode', enabled: boolean) => {
      void clientRef.current
        ?.getMediaStream()
        .enableHardwareAcceleration({ [kind]: enabled })
        .catch(() => false);
      if (kind === 'encode') {
        setHwAccelEncode(enabled);
      } else {
        setHwAccelDecode(enabled);
      }
    },
    [],
  );

  const selectSharePrivilege = useCallback(async (privilege: SharePrivilege) => {
    const client = clientRef.current;
    if (!client) {
      return;
    }
    const result = await client
      .getMediaStream()
      .setSharePrivilege(privilege)
      .catch(() => null);
    if (result === null || result instanceof Error) {
      return;
    }
    setSharePrivilege(privilege);
  }, []);

  // Disconnect and clear refresh recovery before showing post-call feedback.
  // An intentional leave must never rejoin the participant after a refresh.
  const handleLeave = useCallback(() => {
    const client = clientRef.current;
    isLeavingRef.current = true;
    clearLiveSessionRecovery(liveSessionId);
    endShareAnnotations(selfUserIdRef.current);
    if (client) {
      void disposeZoomClient(client, selfUserIdRef.current);
    }
    setShowFeedbackPrompt(true);
  }, [liveSessionId, endShareAnnotations]);

  // This renders as a `fixed inset-0 z-40` portal covering the entire
  // viewport. router.push() in Next.js App Router runs inside a transition
  // that can keep the old page's DOM mounted (and thus visible, since it's
  // on top of everything) until the new page is ready — for most content
  // that's an invisible, seamless swap, but a full-screen overlay stays
  // stuck in front of the destination page for however long that takes, or
  // indefinitely if the embed doesn't unmount cleanly. Setting hasLeft makes
  // this component stop rendering itself immediately, independent of
  // whatever the caller's onLeave navigation does or how long it takes.
  const finishLeaving = useCallback(() => {
    clearLiveSessionRecovery(liveSessionId);
    setShowFeedbackPrompt(false);
    setHasLeft(true);
    onLeave?.();
  }, [liveSessionId, onLeave]);

  const submitFeedback = useCallback(async () => {
    if (feedbackRating === null) {
      finishLeaving();
      return;
    }
    setIsFeedbackSubmitting(true);
    await submitLiveSessionFeedback(
      liveSessionId,
      { rating: feedbackRating, displayName },
      accessToken,
    ).catch(() => null);
    setIsFeedbackSubmitting(false);
    finishLeaving();
  }, [feedbackRating, liveSessionId, displayName, accessToken, finishLeaving]);

  const participantCount = remoteParticipants.length + 1;

  if (hasLeft) {
    return null;
  }

  if (status === 'error') {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-sm font-medium text-destructive">
          Couldn&apos;t join the session
        </p>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
        {errorDetail ? (
          <details className="w-full text-left">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Technical details
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-left text-xs">
              {errorDetail}
            </pre>
          </details>
        ) : null}
      </div>
    );
  }

  const isSomeoneSharing = activeShareUserId !== null;
  const isLocalShare =
    activeShareUserId !== null && activeShareUserId === selfUserIdRef.current;
  const isShowingLocalShare =
    isLocalShare || (isSharingScreen && activeShareUserId === null);
  const meetingNotice = mediaError
    ? {
        message: mediaError,
        onDismiss: () => setMediaError(null),
        action: { label: 'Refresh', onClick: () => window.location.reload() },
      }
    : shareError
      ? {
          message: shareError,
          onDismiss: () => setShareError(null),
          ...(recordingStatus === RecordingStatus.Paused &&
          recording.action?.label === 'Resume recording'
            ? {
                action: {
                  label: 'Resume recording',
                  onClick: () => recording.action?.onSelect(),
                },
              }
            : {}),
        }
      : recordingComposition.error
        ? {
            message: recordingComposition.error,
            onDismiss: recordingComposition.dismissError,
          }
        : whiteboardError
          ? { message: whiteboardError, onDismiss: whiteboard.dismissError }
          : captionsError
            ? { message: captionsError, onDismiss: () => setCaptionsError(null) }
            : null;
  const isWhiteboardActive = whiteboardStatus !== WhiteboardStatus.Closed;
  // Zoom can publish the local share before its active-share participant ID
  // reaches the user state. Drive the presentation layout from either signal
  // so the self tile moves into the filmstrip immediately instead of leaving
  // the reserved right rail empty during that synchronization window.
  const isPresentationLayoutActive = shouldUsePresentationLayout({
    hasActiveShareUser: isSomeoneSharing,
    isShowingLocalShare,
    isWhiteboardActive,
  });
  // Rendered via a portal straight to document.body: a `fixed inset-0`
  // element only actually covers the real viewport if no ancestor sets a
  // transform/filter/etc. (any of which creates its own containing block
  // for fixed descendants) — this component is mounted deep inside page
  // layout wrappers we don't control, so the portal is what guarantees the
  // floating control bar and panels truly anchor to the screen, not to
  // whatever box happens to wrap this component on a given page.
  return createPortal(
    <MeetingPipProviders container={pip.pipWindow?.document.body}>
      <MeetingPictureInPictureControls
        pip={pip}
        onCallSettings={() => {
          setActivePanel(null);
          setIsSettingsOpen(true);
        }}
        settingsOpen={showPipSettings}
        onSettingsOpenChange={setShowPipSettings}
      />
      {showFeedbackPrompt ? (
        <ZoomFeedbackScreen
          rating={feedbackRating}
          isSubmitting={isFeedbackSubmitting}
          onRatingChange={setFeedbackRating}
          onSubmit={() => void submitFeedback()}
          onSkip={finishLeaving}
        />
      ) : null}
      <div className="zoom-meeting-shell fixed inset-0 z-40 flex flex-col bg-background">
        <div
          className={cn(
            'relative min-h-0 flex-1 overflow-hidden bg-background transition-opacity duration-500 ease-out motion-reduce:transition-none',
            status === 'connecting' ? 'opacity-70' : 'opacity-100',
          )}
        >
          <div
            className={cn(
              'absolute inset-0 z-40 flex items-center justify-center gap-2 bg-muted text-sm text-muted-foreground transition-opacity duration-500 ease-out motion-reduce:transition-none',
              status === 'connecting'
                ? 'pointer-events-auto opacity-100'
                : 'pointer-events-none opacity-0',
            )}
            aria-hidden={status !== 'connecting'}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Connecting…
          </div>

          <ZoomMeetingHeader
            title={sessionTitle ?? 'Live class'}
            participantCount={participantCount}
            recordingStatus={recordingStatus}
          />

          {meetingNotice ? (
            <ZoomMeetingNotice
              {...meetingNotice}
              className={isShowingLocalShare ? 'top-32' : 'top-20 sm:top-24'}
            />
          ) : recording.showBanner ? (
            <ZoomMeetingNotice
              title="Recording"
              message="This session is being recorded"
              tone="warning"
              onDismiss={recording.dismissBanner}
              className={isShowingLocalShare ? 'top-32' : 'top-20 sm:top-24'}
            />
          ) : null}

          <ZoomShareStage
            localSharing={isSharingScreen}
            selfUserId={selfUserIdRef.current}
            annotationOverlay={
              !isWhiteboardActive
                ? (size, presenterId) => (
                    <ScreenAnnotationOverlay
                      sourceComposited={
                        presenterId !== selfUserIdRef.current &&
                        recordingComposition.composited.has(
                          presenterId ?? activeShareUserId ?? -1,
                        )
                      }
                      annotationToken={annotationToken}
                      key={`${liveSessionId}:${presenterId ?? activeShareUserId ?? selfUserIdRef.current}`}
                      onContext={(context) =>
                        annotationLifecycle.remember(
                          String(
                            presenterId ??
                              activeShareUserId ??
                              selfUserIdRef.current ??
                              0,
                          ),
                          context,
                        )
                      }
                      sessionId={liveSessionId}
                      shareKey={String(
                        presenterId ?? activeShareUserId ?? selfUserIdRef.current ?? 0,
                      )}
                      {...size}
                    />
                  )
                : undefined
            }
            remoteCanvasRef={shareCanvasRef}
            localCanvasRef={localShareCanvasRef}
            localVideoRef={localShareVideoRef}
            whiteboardContainerRef={whiteboardContainerRef}
            whiteboardContent={
              whiteboard.nativeToken && isWhiteboardActive ? (
                <ClassroomWhiteboard
                  token={whiteboard.nativeToken}
                  title={sessionTitle}
                />
              ) : undefined
            }
            dimensions={shareContentDimensions}
            showRemoteShare={isSomeoneSharing && !isShowingLocalShare}
            showLocalShare={isShowingLocalShare}
            showWhiteboard={isWhiteboardActive}
            whiteboardLoading={whiteboardStatus === WhiteboardStatus.Pending}
            localRenderTarget={localShareRenderTarget}
            sidebarOpen={activePanel !== null}
            sharePresenters={sharePresenters}
            activeShareUserId={activeShareUserId}
            onSelectShare={(userId) => void selectSharedScreen(userId)}
          />

          {!isPresentationLayoutActive ? (
            <ZoomParticipantGallery
              displayName={displayName}
              selfAvatar={selfAvatar}
              selfMuted={isMuted}
              selfVideoOn={isVideoOn}
              selfHandRaised={isHandRaised}
              selfVideoRef={selfVideoRef}
              remoteParticipants={remoteParticipants}
              raisedHandUserIds={raisedHandUserIds}
              speakingUserIds={speakingUserIds}
              activeSpeakerUserId={activeSpeakerUserId}
              selfUserId={selfUserIdRef.current}
              sidebarOpen={activePanel !== null}
              page={galleryPage}
              onPageChange={setGalleryPage}
              onRemoteContainer={(userId, element) => {
                if (element) remoteVideoRefs.current.set(userId, element);
                else remoteVideoRefs.current.delete(userId);
              }}
            />
          ) : null}

          {isPresentationLayoutActive ? (
            <ZoomShareFilmstrip
              displayName={displayName}
              selfAvatar={selfAvatar}
              selfMuted={isMuted}
              selfVideoOn={isVideoOn}
              selfHandRaised={isHandRaised}
              selfVideoRef={selfVideoRef}
              remoteParticipants={remoteParticipants}
              raisedHandUserIds={raisedHandUserIds}
              speakingUserIds={speakingUserIds}
              activeSpeakerUserId={activeSpeakerUserId}
              selfUserId={selfUserIdRef.current}
              sidebarOpen={activePanel !== null}
              onRemoteContainer={(userId, element) => {
                if (element) remoteVideoRefs.current.set(userId, element);
                else remoteVideoRefs.current.delete(userId);
              }}
            />
          ) : null}
        </div>

        {/* Keep the required call controls persistently visible. Zoom's UI
              Toolkit treats this as a required component, and hiding it on
              inactivity made the most important actions hard to discover on
              touch and keyboard-only devices. */}
        {/* Bottom offset is set via inline style, not a Tailwind arbitrary
              value — nesting max()/env() inside a bracketed class is fragile
              across Tailwind/PostCSS versions and silently drops the whole
              declaration if it fails to parse, which is what left this bar
              with no bottom anchor at all (it rendered at the top instead).
              Inline style hands the calc straight to the browser, no
              intermediary parser involved. */}
        {status === 'connected' ? (
          <div
            className="zoom-meeting-gutter-padding absolute inset-x-0 z-30 overflow-x-auto pb-1 sm:overflow-visible"
            style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            <div
              className="zoom-toolbar relative mx-auto flex w-full items-center justify-center gap-1 sm:gap-1.5"
              role="toolbar"
              aria-label="Class controls"
              data-mobile-expanded={showMobileControls}
            >
              <ZoomMeetingTimer elapsedSeconds={elapsedSeconds} />

              <MeetingControlButton
                tooltip={isMuted ? 'Unmute' : 'Mute'}
                label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                tone={isMuted ? 'danger' : 'neutral'}
                aria-pressed={!isMuted}
                onClick={() => void toggleMute()}
              >
                <PoppingIcon toggleKey={isMuted}>
                  <SpeakingAudioIcon
                    muted={isMuted}
                    speaking={speakingUserIds.has(selfUserIdRef.current ?? -1)}
                  />
                </PoppingIcon>
              </MeetingControlButton>

              <MeetingControlButton
                tooltip={isVideoOn ? 'Stop video' : 'Start video'}
                label={isVideoOn ? 'Stop camera' : 'Start camera'}
                tone={isVideoOn ? 'neutral' : 'danger'}
                aria-pressed={isVideoOn}
                onClick={() => void toggleVideo()}
              >
                <PoppingIcon toggleKey={isVideoOn}>
                  {isVideoOn ? (
                    <Video className="h-4 w-4" />
                  ) : (
                    <VideoOff className="h-4 w-4" />
                  )}
                </PoppingIcon>
              </MeetingControlButton>

              <MeetingControlButton
                tooltip={
                  isPipActive && !isSharingScreen
                    ? 'Return to the call to start sharing'
                    : !supportsScreenShare
                      ? 'Screen sharing is not supported by this browser'
                      : isWhiteboardActive
                        ? 'End the whiteboard to share your screen'
                        : 'Share screen'
                }
                label={isSharingScreen ? 'Stop sharing screen' : 'Share screen'}
                tone={isSharingScreen ? 'active' : 'neutral'}
                aria-pressed={isSharingScreen}
                disabled={
                  isWhiteboardActive ||
                  !supportsScreenShare ||
                  (isPipActive && !isSharingScreen)
                }
                onClick={() => void toggleScreenShare()}
              >
                <PoppingIcon toggleKey={isSharingScreen}>
                  {isSharingScreen ? (
                    <MonitorX className="h-4 w-4" />
                  ) : (
                    <MonitorUp className="h-4 w-4" />
                  )}
                </PoppingIcon>
              </MeetingControlButton>

              <ZoomSettingsPanel
                pictureInPictureSettings={<MeetingPipSettings pip={pip} />}
                open={isSettingsOpen}
                hideTrigger
                cameras={cameraList}
                microphones={micList}
                speakers={speakerList}
                activeCameraId={activeCameraId}
                activeMicrophoneId={activeMicId}
                activeSpeakerId={activeSpeakerId}
                audioProcessing={audioProcessing}
                backgroundPreset={backgroundPreset}
                sharePrivilege={sharePrivilege}
                isMirrored={isMirrored}
                hardwareAcceleration={{ encode: hwAccelEncode, decode: hwAccelDecode }}
                supportsNoiseSuppression={supportsNoiseSuppression}
                supportsVirtualBackground={supportsVirtualBackground}
                isHost={isSelfHost}
                onOpenChange={(open) => {
                  setIsSettingsOpen(open);
                  if (open) setActivePanel(null);
                }}
                onSelectCamera={selectCamera}
                onSelectMicrophone={selectMicrophone}
                onSelectSpeaker={selectSpeaker}
                onSelectAudioProcessing={(mode) => void selectAudioProcessing(mode)}
                onToggleMirror={(enabled) => void toggleMirror(enabled)}
                onSelectBackground={(preset) => void selectBackgroundPreset(preset)}
                onToggleHardwareAcceleration={toggleHardwareAcceleration}
                onSelectSharePrivilege={(privilege) =>
                  void selectSharePrivilege(privilege)
                }
              />

              {supportsWhiteboard && (!isSomeoneSharing || isPresentingWhiteboard) ? (
                <MeetingControlButton
                  tooltip={
                    whiteboard.nativeToken
                      ? isWhiteboardActive
                        ? 'Hide whiteboard'
                        : 'Open whiteboard'
                      : isPresentingWhiteboard
                        ? 'Stop whiteboard'
                        : isWhiteboardActive
                          ? 'The other person is presenting the whiteboard'
                          : 'Start whiteboard'
                  }
                  label={
                    whiteboard.nativeToken
                      ? isWhiteboardActive
                        ? 'Hide whiteboard'
                        : 'Open whiteboard'
                      : isPresentingWhiteboard
                        ? 'Stop whiteboard'
                        : 'Start whiteboard'
                  }
                  tone={isPresentingWhiteboard ? 'active' : 'neutral'}
                  disabled={
                    !whiteboard.nativeToken &&
                    !isPresentingWhiteboard &&
                    (isSomeoneSharing || isWhiteboardActive)
                  }
                  onClick={() => void toggleWhiteboard()}
                >
                  <PoppingIcon toggleKey={isPresentingWhiteboard}>
                    <Pencil className="size-4" />
                  </PoppingIcon>
                </MeetingControlButton>
              ) : null}

              {settings.invite.enabled ? (
                <ZoomShareMeetingDialog
                  meetingTitle={sessionTitle ?? sessionName}
                  meetingPasscode={sessionPasscode}
                />
              ) : null}
              <ZoomMoreControls
                error={recordingComposition.error ?? recording.error ?? messages.error}
                open={showMobileControls}
                onOpenChange={setShowMobileControls}
                actions={[
                  ...(recording.action ? [recording.action] : []),
                  {
                    id: 'participants',
                    label: `Participants (${remoteParticipants.length + 1})`,
                    icon: <Users />,
                    active: activePanel === 'users',
                    mobileOnly: true,
                    onSelect: () => setActivePanel('users'),
                  },
                  {
                    id: 'messages',
                    label: unreadChatCount
                      ? `Messages (${unreadChatCount} unread)`
                      : 'Messages',
                    icon: <MessageSquare />,
                    active: activePanel === 'chat',
                    mobileOnly: true,
                    onSelect: () => setActivePanel('chat'),
                  },
                  ...(isWhiteboardActive && !whiteboard.nativeToken
                    ? [
                        {
                          id: 'export-whiteboard',
                          label: 'Export whiteboard as PDF',
                          icon: <Download />,
                          onSelect: exportWhiteboardPdf,
                        },
                      ]
                    : []),
                  ...(pip.supported
                    ? [
                        {
                          id: 'picture-in-picture',
                          label: isPipActive
                            ? 'Exit picture-in-picture'
                            : 'Picture-in-picture',
                          icon: <PictureInPicture2 />,
                          active: isPipActive,
                          onSelect: () => (isPipActive ? exitPip() : void enterPip()),
                        },
                      ]
                    : []),
                  {
                    id: 'captions',
                    label: isCaptionsOn ? 'Turn off captions' : 'Turn on captions',
                    icon: <Captions />,
                    active: isCaptionsOn,
                    onSelect: () => void toggleCaptions(),
                  },
                  {
                    id: 'settings',
                    label: 'Settings',
                    icon: <Settings />,
                    active: isSettingsOpen,
                    onSelect: () => {
                      setActivePanel(null);
                      setIsSettingsOpen(true);
                    },
                  },
                ].filter(
                  (action) =>
                    (action.id !== 'participants' || settings.participants.visible) &&
                    (action.id !== 'messages' || settings.messages.visible),
                )}
              />
              <ZoomMeetingSideDock>
                <ZoomMeetingDockButton
                  tooltip={isHandRaised ? 'Lower hand' : 'Raise hand'}
                  label={isHandRaised ? 'Lower hand' : 'Raise hand'}
                  active={isHandRaised}
                  className="size-12 px-0 shadow-md ring-1 ring-border/70"
                  aria-pressed={isHandRaised}
                  onClick={toggleHandRaise}
                >
                  <PoppingIcon toggleKey={isHandRaised}>
                    <Hand className="size-5" />
                  </PoppingIcon>
                </ZoomMeetingDockButton>

                <Popover>
                  <PopoverTrigger asChild>
                    <ZoomMeetingDockButton
                      label="Open reactions"
                      active={false}
                      className="size-12 px-0 shadow-md ring-1 ring-border/70"
                    >
                      <SmilePlus className="size-5" />
                    </ZoomMeetingDockButton>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    side="top"
                    sideOffset={12}
                    className="flex w-fit gap-1 p-2"
                  >
                    {REACTION_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="flex size-10 cursor-pointer items-center justify-center rounded-lg text-xl hover:bg-accent"
                        onClick={() => sendReaction(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>

                {settings.participants.visible ? (
                  <ZoomParticipantsPanel
                    open={activePanel === 'users'}
                    canMuteOthers={isSelfHost}
                    className="zoom-toolbar-people zoom-toolbar-secondary"
                    participants={[
                      {
                        userId: selfUserIdRef.current ?? -1,
                        name: displayName,
                        avatarUrl: selfAvatar,
                        isYou: true,
                        isHost: isSelfHost,
                        muted: isMuted,
                        videoOn: isVideoOn,
                        handRaised: isHandRaised,
                        reaction:
                          participantReactions[selfUserIdRef.current ?? -1]?.emoji,
                        isSpeaking:
                          selfUserIdRef.current !== null &&
                          speakingUserIds.has(selfUserIdRef.current ?? -1) &&
                          !isMuted,
                      },
                      ...remoteParticipants.map((participant) => ({
                        userId: participant.userId,
                        name: participant.displayName,
                        avatarUrl: participant.avatar,
                        isYou: false,
                        isHost: participant.isHost,
                        muted: participant.muted,
                        videoOn: participant.bVideoOn,
                        handRaised: raisedHandUserIds.has(participant.userId),
                        reaction: participantReactions[participant.userId]?.emoji,
                        isSpeaking:
                          speakingUserIds.has(participant.userId) && !participant.muted,
                      })),
                    ]}
                    onOpenChange={(open) => {
                      setActivePanel(open ? 'users' : null);
                      if (open) setIsSettingsOpen(false);
                    }}
                    onMute={(userId, name) => muteParticipant(userId, name)}
                  />
                ) : null}

                {settings.messages.visible ? (
                  <ZoomChatPanel
                    enabled={settings.messages.enabled}
                    open={activePanel === 'chat'}
                    unreadCount={unreadChatCount}
                    messages={chatMessages}
                    draft={chatDraft}
                    selfUserId={selfUserIdRef.current}
                    scrollRef={chatScrollRef}
                    className="zoom-toolbar-chat zoom-toolbar-secondary"
                    onOpenChange={(open) => {
                      setActivePanel(open ? 'chat' : null);
                      if (open) setIsSettingsOpen(false);
                    }}
                    onDraftChange={setChatDraft}
                    onSend={() => void messages.send()}
                  />
                ) : null}
              </ZoomMeetingSideDock>

              <MeetingControlButton
                tooltip={
                  isSelfHost && remoteParticipants.length === 0
                    ? 'End class'
                    : isSelfHost
                      ? 'Leave or end class'
                      : 'Leave'
                }
                tone="danger"
                className="zoom-toolbar-leave sticky right-0 z-10"
                label={
                  isSelfHost && remoteParticipants.length === 0
                    ? 'End class'
                    : isSelfHost
                      ? 'Leave or end class'
                      : 'Leave class'
                }
                onClick={() => setShowEndForAllConfirm(true)}
              >
                <PoppingIcon toggleKey={isSelfHost && remoteParticipants.length === 0}>
                  {isSelfHost && remoteParticipants.length === 0 ? (
                    <OctagonX className="h-4 w-4" />
                  ) : (
                    <PhoneOff className="h-4 w-4" />
                  )}
                </PoppingIcon>
              </MeetingControlButton>
            </div>
          </div>
        ) : null}

        {isCaptionsOn && captionText ? (
          <div className="absolute inset-x-4 bottom-24 z-20 mx-auto w-fit max-w-lg rounded-lg bg-black/80 px-4 py-2 text-center text-sm text-white">
            {captionText}
          </div>
        ) : null}

        {connectionState === ConnectionState.Reconnecting ? (
          <div
            className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 bg-background/85 text-sm text-muted-foreground backdrop-blur-sm"
            role="status"
            aria-live="assertive"
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-medium text-foreground">Reconnecting to class…</span>
            <span>
              Keep this tab open. Your audio and video will resume automatically.
            </span>
          </div>
        ) : null}

        {sessionEndMessage ? (
          <div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/95 px-6 text-center backdrop-blur-sm"
            role="alert"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <PhoneOff className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="max-w-md space-y-1">
              <h2 className="text-lg font-semibold text-foreground">
                Class disconnected
              </h2>
              <p className="text-sm text-muted-foreground">{sessionEndMessage}</p>
            </div>
            <Button type="button" onClick={finishLeaving}>
              Return to class page
            </Button>
          </div>
        ) : null}

        {/* Reactions pop from the sender's visible tile, then drift up and fade. */}
        <div
          ref={reactionOverlayRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
        >
          {floatingReactions.map((reaction) => (
            <span
              key={reaction.id}
              className="absolute text-5xl will-change-transform"
              style={
                {
                  left: reaction.origin.x,
                  top: reaction.origin.y,
                  '--dx': `${reaction.dx}px`,
                  '--rot': `${reaction.rotate}deg`,
                  animation: `float-reaction ${reaction.durationMs}ms forwards`,
                } as React.CSSProperties
              }
            >
              {reaction.emoji}
            </span>
          ))}
        </div>

        <ZoomMeetingLayoutStyles />
      </div>

      <AlertDialog open={showEndForAllConfirm} onOpenChange={setShowEndForAllConfirm}>
        <AlertDialogContent>
          {!isSelfHost ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Leave the class?</AlertDialogTitle>
                <AlertDialogDescription>
                  You can rejoin anytime while the class is still live.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleLeave}>
                  Leave
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : remoteParticipants.length === 0 ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>End the class?</AlertDialogTitle>
                <AlertDialogDescription>
                  You&apos;re the only one here, so this ends the class for good rather
                  than just leaving it running.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={endSessionForEveryone}>
                  End class
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Leave or end the class?</AlertDialogTitle>
                <AlertDialogDescription>
                  Leave and the class keeps going for everyone else. End it and every
                  participant is disconnected immediately.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="outline" onClick={handleLeave}>
                  Leave
                </AlertDialogAction>
                <AlertDialogAction variant="destructive" onClick={endSessionForEveryone}>
                  End for everyone
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </MeetingPipProviders>,
    pip.host ?? document.body,
  );
}
