'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DailyAudio,
  DailyProvider,
  DailyVideo,
  useAudioLevel,
  useCallObject,
  useDailyEvent,
  useDevices,
  useInputSettings,
  useLocalSessionId,
  useMeetingState,
  useParticipant,
  useParticipantIds,
  useParticipantCounts,
  useRecording,
} from '@daily-co/daily-react';
import type { DailyInputSettings } from '@daily-co/daily-js';
import {
  Camera,
  Loader2,
  Mic,
  MicOff,
  MonitorUp,
  RefreshCw,
  Users,
  Video,
  VideoOff,
  Volume2,
  WandSparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@iconicedu/ui-web/ui/button';
import { Avatar, AvatarFallback } from '@iconicedu/ui-web/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web/ui/select';
import { Switch } from '@iconicedu/ui-web/ui/switch';
import { ControlBar } from '@iconicedu/web/components/live-sessions/control-bar';
import {
  DAILY_BACKGROUND_PRESET_OPTIONS,
  buildDailyDirectCallComposition,
  buildDailyParticipantIds,
  buildDailyBackgroundProcessor,
  getDailyBackgroundPresetValue,
  getDailyDeviceLabel,
  getDailyLiveSessionErrorMessage,
  getDailyParticipantInitials,
  getDailyParticipantLabel,
  buildDailySpeakingWaveformBars,
  isDirectLiveSessionLayout,
  isDailyParticipantMicMuted,
  isDailyParticipantSpeaking,
  shouldShowFullMeetingControls,
} from '@iconicedu/web/components/live-sessions/daily-live-session-embed.utils';
import { type LiveSessionViewType } from '@iconicedu/web/components/live-sessions/view-switcher';
import { VideoParticipant } from '@iconicedu/web/components/live-sessions/video-participant';

function DailyParticipantTile({
  sessionId,
  isLocal,
  variant = 'default',
}: {
  sessionId: string;
  isLocal?: boolean;
  variant?: 'default' | 'floating';
}) {
  const participant = useParticipant(sessionId);
  const [audioLevel, setAudioLevel] = useState(0);
  const participantLabel = getDailyParticipantLabel({
    isLocal,
    userName: participant?.user_name,
  });
  const participantInitials = getDailyParticipantInitials(participant?.user_name);
  const isVideoOff = participant?.tracks.video.state !== 'playable';
  const isSpeaking = isDailyParticipantSpeaking(audioLevel);
  const isMicMuted = isDailyParticipantMicMuted({
    audioState: participant?.tracks.audio.state,
  });
  const waveformBars = buildDailySpeakingWaveformBars(isSpeaking);
  const isFloating = variant === 'floating';

  useAudioLevel(participant?.tracks.audio.persistentTrack, setAudioLevel);

  return (
    <VideoParticipant
      name={participantLabel}
      isMuted={isMicMuted}
      isActive={isSpeaking}
      isSpeaking={isSpeaking}
      initials={participantInitials}
      aspectClassName="aspect-[16/9]"
    >
      {!isVideoOff ? (
        <DailyVideo
          automirror={isLocal}
          fit="cover"
          muted={isLocal}
          playableStyle={{ objectFit: 'cover' }}
          sessionId={sessionId}
          type="video"
          className={[
            'h-full w-full bg-muted',
            isFloating ? 'min-h-[128px]' : 'min-h-[176px] md:min-h-[200px]',
          ].join(' ')}
        />
      ) : undefined}
    </VideoParticipant>
  );
}

function DailyScreenShareTile({
  sessionId,
}: {
  sessionId: string;
}) {
  const participant = useParticipant(sessionId);
  const participantLabel = getDailyParticipantLabel({
    isLocal: participant?.local,
    userName: participant?.user_name,
  });

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-border bg-card shadow-[0_12px_40px_rgba(15,23,42,0.18)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
      <DailyVideo
        fit="contain"
        muted
        playableStyle={{ objectFit: 'contain' }}
        sessionId={sessionId}
        type="screenVideo"
        className="h-full w-full bg-black"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 to-transparent px-4 py-3">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <Video className="h-4 w-4" />
          <span>{participantLabel} is sharing</span>
        </div>
      </div>
    </div>
  );
}

function DailyParticipantListItem({
  sessionId,
  isLocal,
}: {
  sessionId: string;
  isLocal?: boolean;
}) {
  const participant = useParticipant(sessionId);
  const participantLabel = getDailyParticipantLabel({
    isLocal,
    userName: participant?.user_name,
  });
  const participantInitials = getDailyParticipantInitials(participant?.user_name);
  const isMicMuted = isDailyParticipantMicMuted({
    audioState: participant?.tracks.audio.state,
  });
  const isCameraOff = participant?.tracks.video.state !== 'playable';

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/70 px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-9 w-9 border border-border">
          <AvatarFallback>{participantInitials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{participantLabel}</p>
          <p className="text-xs text-muted-foreground">{isLocal ? 'You' : 'Participant'}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {isCameraOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
      </div>
    </div>
  );
}

function DailyPreJoinPreview({
  participant,
  isCameraEnabled,
  isMicEnabled,
  meetingName,
}: {
  participant: ReturnType<NonNullable<ReturnType<typeof useCallObject>>['participants']>['local'] | undefined;
  isCameraEnabled: boolean;
  isMicEnabled: boolean;
  meetingName?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoTrack = participant?.tracks.video.persistentTrack;
  const participantInitials = getDailyParticipantInitials(participant?.user_name);
  const participantLabel = meetingName?.trim() || participant?.user_name?.trim() || 'You';

  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }

    if (videoTrack && isCameraEnabled) {
      const stream = new MediaStream([videoTrack]);
      element.srcObject = stream;
      void element.play().catch(() => undefined);

      return () => {
        element.pause();
        element.srcObject = null;
        stream.getTracks().forEach((track) => track.stop());
      };
    }

    element.pause();
    element.srcObject = null;

    return undefined;
  }, [isCameraEnabled, videoTrack]);

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_10px_40px_rgba(15,23,42,0.12)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      {videoTrack && isCameraEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="aspect-[16/9] h-full w-full bg-black object-cover"
        />
      ) : (
        <div className="flex aspect-[16/9] h-full w-full items-center justify-center bg-muted">
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-24 w-24 border border-border shadow-sm">
              <AvatarFallback className="text-2xl">{participantInitials}</AvatarFallback>
            </Avatar>
            <p className="text-sm font-medium text-foreground">{participantLabel}</p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 to-transparent px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {isMicEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          <span>{participantLabel}</span>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-center gap-3">
        <div className="rounded-full border border-white/20 bg-black/45 p-3 text-white backdrop-blur">
          {isMicEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </div>
        <div className="rounded-full border border-white/20 bg-black/45 p-3 text-white backdrop-blur">
          {isCameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </div>
        <div className="rounded-full border border-white/20 bg-black/45 p-3 text-white backdrop-blur">
          <WandSparkles className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function DailyLiveSessionSurface({
  callObject,
  joinUrl,
  token,
  externalJoinUrl,
  channelKind,
  mode,
  returnPath,
  meetingName,
}: {
  callObject: NonNullable<ReturnType<typeof useCallObject>>;
  joinUrl: string;
  token?: string | null;
  externalJoinUrl?: string | null;
  channelKind?: string | null;
  mode?: 'video' | 'audio' | null;
  returnPath: string;
  meetingName?: string | null;
}) {
  const router = useRouter();
  const localSessionId = useLocalSessionId();
  const remoteParticipantIds = useParticipantIds({ filter: 'remote' });
  const participantCounts = useParticipantCounts();
  const meetingState = useMeetingState();
  const recording = useRecording();
  const {
    cameras,
    microphones,
    speakers,
    currentCam,
    currentMic,
    currentSpeaker,
    setCamera,
    setMicrophone,
    setSpeaker,
    refreshDevices,
  } = useDevices();
  const { inputSettings, updateInputSettings, errorMsg: inputSettingsError } = useInputSettings();
  const [error, setError] = useState<string | null>(null);
  const [isPreparingPreview, setIsPreparingPreview] = useState(true);
  const [hasStartedJoin, setHasStartedJoin] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(mode !== 'audio');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isRefreshingDevices, setIsRefreshingDevices] = useState(false);
  const [isApplyingDevice, setIsApplyingDevice] = useState<string | null>(null);
  const [isApplyingInputSettings, setIsApplyingInputSettings] = useState(false);
  const [currentView, setCurrentView] = useState<LiveSessionViewType>('gallery');
  const [participantTrackVersion, setParticipantTrackVersion] = useState(0);
  const shouldRouteOnLeaveRef = useRef(true);
  const isDirectCall = isDirectLiveSessionLayout({ channelKind, mode });
  const showFullMeetingControls = shouldShowFullMeetingControls({ channelKind, mode });
  const backgroundPreset = getDailyBackgroundPresetValue({
    processor: inputSettings?.video?.processor ?? null,
  });
  const isNoiseCancellationEnabled = inputSettings?.audio?.processor?.type === 'noise-cancellation';

  const handleLeftMeeting = useCallback(() => {
    if (!shouldRouteOnLeaveRef.current) {
      return;
    }
    router.push(returnPath);
  }, [returnPath, router]);

  const handleError = useCallback((event: { errorMsg?: string } | undefined) => {
    setIsJoining(false);
    setError(event?.errorMsg ?? 'Failed to join live session');
  }, []);

  useDailyEvent('left-meeting', handleLeftMeeting);
  useDailyEvent('error', handleError);
  useDailyEvent(
    'participant-updated',
    useCallback(() => {
      setParticipantTrackVersion((value) => value + 1);
    }, []),
  );
  useDailyEvent(
    'participant-joined',
    useCallback(() => {
      setParticipantTrackVersion((value) => value + 1);
    }, []),
  );
  useDailyEvent(
    'participant-left',
    useCallback(() => {
      setParticipantTrackVersion((value) => value + 1);
    }, []),
  );
  useDailyEvent(
    'local-screen-share-started',
    useCallback(() => {
      setParticipantTrackVersion((value) => value + 1);
      setCurrentView('shared-content');
    }, []),
  );
  useDailyEvent(
    'local-screen-share-stopped',
    useCallback(() => {
      setParticipantTrackVersion((value) => value + 1);
      setCurrentView((view) => (view === 'shared-content' ? 'gallery' : view));
    }, []),
  );
  useDailyEvent(
    'joined-meeting',
    useCallback(() => {
      setIsJoining(false);
      setIsPreparingPreview(false);
      setHasStartedJoin(true);
      setError(null);
      setParticipantTrackVersion((value) => value + 1);
    }, []),
  );

  useEffect(() => {
    let isActive = true;

    setIsPreparingPreview(true);
    setError(null);

    void callObject
      .startCamera()
      .then(() => {
        if (!isActive) {
          return;
        }
        setIsPreparingPreview(false);
        setParticipantTrackVersion((value) => value + 1);
      })
      .catch((previewError: unknown) => {
        if (!isActive) {
          return;
        }
        setIsPreparingPreview(false);
        setError(getDailyLiveSessionErrorMessage(previewError));
      });

    return () => {
      isActive = false;
      shouldRouteOnLeaveRef.current = false;
      void callObject.leave().catch(() => undefined);
    };
  }, [callObject]);

  const handleLeave = async () => {
    if (isLeaving) {
      return;
    }

    shouldRouteOnLeaveRef.current = true;
    setIsLeaving(true);
    try {
      await callObject.leave();
    } catch {
      router.push(returnPath);
    } finally {
      setIsLeaving(false);
    }
  };

  const handleJoinMeeting = async () => {
    if (isJoining) {
      return;
    }

    setHasStartedJoin(true);
    setIsJoining(true);
    setError(null);

    try {
      await callObject.join({
        url: joinUrl,
        token: token ?? undefined,
      });
    } catch (joinError: unknown) {
      setIsJoining(false);
      setError(getDailyLiveSessionErrorMessage(joinError));
    }
  };

  const participantIds = useMemo(
    () =>
      buildDailyParticipantIds({
        localSessionId,
        remoteParticipantIds,
      }),
    [localSessionId, remoteParticipantIds],
  );
  const directCallComposition = useMemo(
    () =>
      buildDailyDirectCallComposition({
        localSessionId,
        remoteParticipantIds,
      }),
    [localSessionId, remoteParticipantIds],
  );
  const activeScreenShareSessionId = useMemo(() => {
    const participants = callObject.participants();
    for (const sessionId of participantIds) {
      if (participants[sessionId]?.tracks.screenVideo.state === 'playable') {
        return sessionId;
      }
    }
    return null;
  }, [callObject, participantIds, participantTrackVersion]);
  const isScreenSharing = useMemo(() => {
    if (!localSessionId) {
      return false;
    }

    const participants = callObject.participants();
    return participants[localSessionId]?.tracks.screenVideo.state === 'playable';
  }, [callObject, localSessionId, participantTrackVersion]);
  const stageParticipantIds = useMemo(
    () => participantIds.filter((sessionId) => sessionId !== activeScreenShareSessionId),
    [activeScreenShareSessionId, participantIds],
  );
  const localParticipant = useParticipant(localSessionId ?? undefined);
  const previewParticipant = useMemo(() => callObject.participants().local, [callObject, participantTrackVersion]);
  const isHandRaised = Boolean(
    localParticipant &&
      typeof localParticipant.userData === 'object' &&
      localParticipant.userData !== null &&
      'raisedHand' in localParticipant.userData &&
      localParticipant.userData.raisedHand,
  );

  const applyInputSettings = useCallback(
    async (nextInputSettings: DailyInputSettings) => {
      if (!updateInputSettings) {
        return;
      }

      setIsApplyingInputSettings(true);
      try {
        await updateInputSettings(nextInputSettings);
      } catch (inputError: unknown) {
        setError(getDailyLiveSessionErrorMessage(inputError));
      } finally {
        setIsApplyingInputSettings(false);
      }
    },
    [updateInputSettings],
  );

  const handleToggleMic = () => {
    const next = !isMicEnabled;
    callObject.setLocalAudio(next);
    setIsMicEnabled(next);
  };

  const handleToggleCamera = () => {
    const next = !isCameraEnabled;
    callObject.setLocalVideo(next);
    setIsCameraEnabled(next);
  };

  const handleToggleScreenShare = () => {
    if (!isScreenSharing) {
      callObject.startScreenShare();
      setCurrentView('shared-content');
    } else {
      callObject.stopScreenShare();
      setCurrentView((view) => (view === 'shared-content' ? 'gallery' : view));
    }
  };

  const handleToggleRaiseHand = async () => {
    const currentUserData =
      localParticipant && typeof localParticipant.userData === 'object' && localParticipant.userData !== null
        ? localParticipant.userData
        : {};

    try {
      await callObject.setUserData({
        ...currentUserData,
        raisedHand: !isHandRaised,
      });
      setParticipantTrackVersion((value) => value + 1);
    } catch (raiseHandError: unknown) {
      setError(getDailyLiveSessionErrorMessage(raiseHandError));
    }
  };

  const handleRefreshDevices = async () => {
    setIsRefreshingDevices(true);
    try {
      await refreshDevices();
    } finally {
      setIsRefreshingDevices(false);
    }
  };

  const handleSelectDevice = async (
    kind: 'camera' | 'microphone' | 'speaker',
    deviceId: string,
  ) => {
    if (!deviceId) {
      return;
    }

    setIsApplyingDevice(`${kind}:${deviceId}`);
    try {
      if (kind === 'camera') {
        await setCamera(deviceId);
      } else if (kind === 'microphone') {
        await setMicrophone(deviceId);
      } else {
        await setSpeaker(deviceId);
      }
    } catch (deviceError: unknown) {
      setError(getDailyLiveSessionErrorMessage(deviceError));
    } finally {
      setIsApplyingDevice(null);
    }
  };

  const handleToggleNoiseCancellation = async (enabled: boolean) => {
    await applyInputSettings({
      ...(inputSettings ?? {}),
      audio: {
        ...(inputSettings?.audio ?? {}),
        processor: { type: enabled ? 'noise-cancellation' : 'none' },
      },
    });
  };

  const handleSelectBackgroundPreset = async (preset: string) => {
    await applyInputSettings({
      ...(inputSettings ?? {}),
      video: {
        ...(inputSettings?.video ?? {}),
        processor: buildDailyBackgroundProcessor(
          preset as (typeof DAILY_BACKGROUND_PRESET_OPTIONS)[number]['value'],
        ),
      },
    });
  };

  return (
    <div className="flex flex-1 flex-col bg-background px-4 py-4 text-foreground">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_10px_40px_rgba(15,23,42,0.12)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        {isJoining && !error ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/85">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Joining live session...
            </div>
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 px-6 text-center">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Live session unavailable</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : null}

        <div className="mx-auto flex h-full min-h-[60vh] max-w-[1440px] flex-col gap-3 p-3 md:min-h-[62vh] md:gap-4 md:p-4">
          <DailyAudio />

          {!hasStartedJoin && meetingState !== 'joined-meeting' ? (
            <div className="grid flex-1 items-center gap-8 px-4 py-4 md:grid-cols-[minmax(0,1fr)_320px] md:px-8">
              <div className="min-w-0">
                {isPreparingPreview ? (
                  <div className="flex aspect-[16/9] items-center justify-center rounded-[28px] border border-border bg-muted/40">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Preparing your camera preview...
                    </div>
                  </div>
                ) : (
                  <DailyPreJoinPreview
                    participant={previewParticipant}
                    isCameraEnabled={isCameraEnabled}
                    isMicEnabled={isMicEnabled}
                    meetingName={meetingName}
                  />
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5">
                    <Mic className="h-3.5 w-3.5" />
                    <span>{getDailyDeviceLabel({ label: currentMic?.device.label, kind: currentMic?.device.kind, index: 0 })}</span>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5">
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>{getDailyDeviceLabel({ label: currentSpeaker?.device.label, kind: currentSpeaker?.device.kind, index: 0 })}</span>
                  </div>
                  {mode !== 'audio' ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5">
                      <Camera className="h-3.5 w-3.5" />
                      <span>{getDailyDeviceLabel({ label: currentCam?.device.label, kind: currentCam?.device.kind, index: 0 })}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    {meetingName?.trim() || (isDirectCall ? 'Direct session' : 'Live session')}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Check your camera, microphone, background, and devices before you join.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => void handleJoinMeeting()}
                    disabled={isPreparingPreview || isJoining}
                  >
                    {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Join now
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    onClick={() => setIsSettingsOpen((open) => !open)}
                  >
                    <MonitorUp className="h-4 w-4" />
                    {isSettingsOpen ? 'Hide setup' : 'Setup'}
                  </Button>
                </div>

                <div className="space-y-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Other joining options</p>
                  <button
                    type="button"
                    className="flex items-center gap-2 text-left transition-colors hover:text-foreground"
                    onClick={() => setIsSettingsOpen((open) => !open)}
                  >
                    <Camera className="h-4 w-4" />
                    <span>Adjust camera, mic, speakers, and background</span>
                  </button>
                  {externalJoinUrl ? (
                    <a
                      href={externalJoinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 transition-colors hover:text-foreground"
                    >
                      <MonitorUp className="h-4 w-4" />
                      <span>Open this live session in a new tab</span>
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {hasStartedJoin && isParticipantsOpen ? (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Participants</p>
                  <p className="text-xs text-muted-foreground">
                    {participantCounts.present} in this live session
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsParticipantsOpen(false)}
                >
                  Close
                </Button>
              </div>

              <div className="mt-4 grid gap-2">
                {participantIds.map((sessionId) => (
                  <DailyParticipantListItem
                    key={`participant-list-${sessionId}`}
                    sessionId={sessionId}
                    isLocal={sessionId === localSessionId}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {isSettingsOpen ? (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Session settings</p>
                  <p className="text-xs text-muted-foreground">
                    Choose your devices and Daily effects for this session.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleRefreshDevices()}
                  disabled={isRefreshingDevices}
                >
                  {isRefreshingDevices ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Refresh devices
                </Button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {mode !== 'audio' ? (
                  <label className="space-y-2">
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Camera className="h-3.5 w-3.5" />
                      Camera
                    </span>
                    <Select
                      value={currentCam?.device.deviceId ?? ''}
                      onValueChange={(value) => void handleSelectDevice('camera', value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select camera" />
                      </SelectTrigger>
                      <SelectContent>
                        {cameras.map((camera, index) => (
                          <SelectItem key={camera.device.deviceId} value={camera.device.deviceId}>
                            {getDailyDeviceLabel({
                              label: camera.device.label,
                              kind: camera.device.kind,
                              index,
                            })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                ) : null}

                <label className="space-y-2">
                  <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Mic className="h-3.5 w-3.5" />
                    Microphone
                  </span>
                  <Select
                    value={currentMic?.device.deviceId ?? ''}
                    onValueChange={(value) => void handleSelectDevice('microphone', value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select microphone" />
                    </SelectTrigger>
                    <SelectContent>
                      {microphones.map((microphone, index) => (
                        <SelectItem
                          key={microphone.device.deviceId}
                          value={microphone.device.deviceId}
                        >
                          {getDailyDeviceLabel({
                            label: microphone.device.label,
                            kind: microphone.device.kind,
                            index,
                          })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="space-y-2">
                  <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Volume2 className="h-3.5 w-3.5" />
                    Speaker
                  </span>
                  <Select
                    value={currentSpeaker?.device.deviceId ?? ''}
                    onValueChange={(value) => void handleSelectDevice('speaker', value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select speaker" />
                    </SelectTrigger>
                    <SelectContent>
                      {speakers.map((speaker, index) => (
                        <SelectItem key={speaker.device.deviceId} value={speaker.device.deviceId}>
                          {getDailyDeviceLabel({
                            label: speaker.device.label,
                            kind: speaker.device.kind,
                            index,
                          })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                {mode !== 'audio' ? (
                  <label className="space-y-2">
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <WandSparkles className="h-3.5 w-3.5" />
                      Background
                    </span>
                    <Select
                      value={backgroundPreset}
                      onValueChange={(value) => void handleSelectBackgroundPreset(value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Background effect" />
                      </SelectTrigger>
                      <SelectContent>
                        {DAILY_BACKGROUND_PRESET_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={isNoiseCancellationEnabled}
                    onCheckedChange={(checked) => void handleToggleNoiseCancellation(checked)}
                    disabled={isApplyingInputSettings}
                  />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">Noise cancellation</p>
                    <p className="text-xs text-muted-foreground">
                      Reduce room noise on your microphone input.
                    </p>
                  </div>
                </div>

                {isApplyingDevice || isApplyingInputSettings ? (
                  <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Applying changes...
                  </div>
                ) : null}

                {isApplyingDevice ? (
                  <div className="text-xs text-muted-foreground">
                    Updating {isApplyingDevice.split(':')[0]}...
                  </div>
                ) : null}

                {inputSettingsError ? (
                  <div className="text-xs text-destructive">{inputSettingsError}</div>
                ) : null}
              </div>
            </div>
          ) : null}

          {hasStartedJoin && participantIds.length > 0 ? (
            <div
              className={[
                'min-h-0 flex-1',
                activeScreenShareSessionId && !isDirectCall
                  ? 'flex flex-col gap-3'
                  : isDirectCall && directCallComposition.useOneToOneLayout
                  ? 'relative'
                  : isDirectCall
                    ? 'grid grid-cols-1 gap-3 md:grid-cols-2'
                    : currentView === 'speaker'
                      ? 'grid grid-cols-1 gap-3'
                      : currentView === 'gallery'
                        ? 'grid grid-cols-1 gap-3 md:grid-cols-2'
                        : 'grid grid-cols-1 gap-3',
              ].join(' ')}
            >
              {activeScreenShareSessionId && !isDirectCall ? (
                <>
                  <div className="min-h-0 flex-1">
                    <DailyScreenShareTile sessionId={activeScreenShareSessionId} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {stageParticipantIds.map((sessionId) => (
                      <DailyParticipantTile
                        key={sessionId}
                        sessionId={sessionId}
                        isLocal={sessionId === localSessionId}
                      />
                    ))}
                  </div>
                </>
              ) : isDirectCall && directCallComposition.useOneToOneLayout ? (
                <>
                  {directCallComposition.primaryParticipantId ? (
                    <DailyParticipantTile
                      key={directCallComposition.primaryParticipantId}
                      sessionId={directCallComposition.primaryParticipantId}
                      isLocal={directCallComposition.primaryParticipantId === localSessionId}
                    />
                  ) : null}
                  {directCallComposition.floatingParticipantId ? (
                    <div className="absolute bottom-3 right-3 z-10 w-[22vw] min-w-[144px] max-w-[208px] md:bottom-4 md:right-4">
                      <DailyParticipantTile
                        key={directCallComposition.floatingParticipantId}
                        sessionId={directCallComposition.floatingParticipantId}
                        isLocal={directCallComposition.floatingParticipantId === localSessionId}
                        variant="floating"
                      />
                    </div>
                  ) : null}
                </>
              ) : (
                participantIds.map((sessionId) => (
                  <DailyParticipantTile
                    key={sessionId}
                    sessionId={sessionId}
                    isLocal={sessionId === localSessionId}
                  />
                ))
              )}
            </div>
          ) : hasStartedJoin ? (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 text-center">
              <div className="space-y-3 text-muted-foreground">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Waiting for participants</p>
                  <p className="text-sm">Share the live session message or join link to bring others in.</p>
                </div>
              </div>
            </div>
          ) : null}

          {hasStartedJoin && !localSessionId ? (
            <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <VideoOff className="h-4 w-4" />
              Camera preview will appear after Daily finishes joining the room.
            </div>
          ) : null}
        </div>
      </div>

      <ControlBar
        microphoneOptions={microphones.map((microphone, index) => ({
          id: microphone.device.deviceId,
          label: getDailyDeviceLabel({
            label: microphone.device.label,
            kind: microphone.device.kind,
            index,
          }),
        }))}
        cameraOptions={cameras.map((camera, index) => ({
          id: camera.device.deviceId,
          label: getDailyDeviceLabel({
            label: camera.device.label,
            kind: camera.device.kind,
            index,
          }),
        }))}
        currentMicrophoneId={currentMic?.device.deviceId ?? null}
        currentCameraId={currentCam?.device.deviceId ?? null}
        meetingName={meetingName?.trim() || (isDirectCall ? 'Direct session' : 'Live session')}
        isMuted={!isMicEnabled}
        isVideoOn={isCameraEnabled}
        isSharing={isScreenSharing}
        isDirectCall={isDirectCall}
        isEnding={isLeaving}
        isParticipantsOpen={isParticipantsOpen}
        isHandRaised={isHandRaised}
        currentView={hasStartedJoin && !isDirectCall ? currentView : undefined}
        onToggleMute={handleToggleMic}
        onToggleVideo={handleToggleCamera}
        onToggleShare={handleToggleScreenShare}
        onToggleParticipants={() => setIsParticipantsOpen((open) => !open)}
        onToggleSettings={() => setIsSettingsOpen((open) => !open)}
        onToggleRaiseHand={() => void handleToggleRaiseHand()}
        onEndCall={() => void (hasStartedJoin ? handleLeave() : router.push(returnPath))}
        onSelectMicrophone={(id) => void handleSelectDevice('microphone', id)}
        onSelectCamera={(id) => void handleSelectDevice('camera', id)}
        onViewChange={hasStartedJoin && !isDirectCall ? setCurrentView : undefined}
      />
    </div>
  );
}

export function DailyLiveSessionEmbed({
  joinUrl,
  token,
  externalJoinUrl,
  channelKind,
  mode,
  returnPath,
  meetingName,
}: {
  joinUrl: string;
  token?: string | null;
  externalJoinUrl?: string | null;
  channelKind?: string | null;
  mode?: 'video' | 'audio' | null;
  returnPath: string;
  meetingName?: string | null;
}) {
  const callObject = useCallObject({
    options: {
      startAudioOff: false,
      startVideoOff: false,
      subscribeToTracksAutomatically: true,
    },
  });

  useEffect(() => {
    return () => {
      void callObject?.destroy().catch(() => undefined);
    };
  }, [callObject]);

  if (!callObject) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-10 text-center">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Live session unavailable</p>
          <p className="text-sm text-muted-foreground">
            Your browser could not initialize the Daily call object.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DailyProvider callObject={callObject}>
      <DailyLiveSessionSurface
        callObject={callObject}
        joinUrl={joinUrl}
        token={token}
        externalJoinUrl={externalJoinUrl}
        channelKind={channelKind}
        mode={mode}
        returnPath={returnPath}
        meetingName={meetingName}
      />
    </DailyProvider>
  );
}
