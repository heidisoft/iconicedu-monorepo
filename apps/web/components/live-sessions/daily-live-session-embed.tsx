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
  RefreshCw,
  Users,
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
import {
  ViewSwitcher,
  type LiveSessionViewType,
} from '@iconicedu/web/components/live-sessions/view-switcher';
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
      aspectClassName={isFloating ? '' : 'aspect-[16/9]'}
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
            'h-full w-full bg-zinc-950',
            isFloating ? 'min-h-[128px]' : 'min-h-[176px] md:min-h-[200px]',
          ].join(' ')}
        />
      ) : undefined}
    </VideoParticipant>
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
}: {
  callObject: NonNullable<ReturnType<typeof useCallObject>>;
  joinUrl: string;
  token?: string | null;
  externalJoinUrl?: string | null;
  channelKind?: string | null;
  mode?: 'video' | 'audio' | null;
  returnPath: string;
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
  const [isJoining, setIsJoining] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(mode !== 'audio');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRefreshingDevices, setIsRefreshingDevices] = useState(false);
  const [isApplyingDevice, setIsApplyingDevice] = useState<string | null>(null);
  const [isApplyingInputSettings, setIsApplyingInputSettings] = useState(false);
  const [currentView, setCurrentView] = useState<LiveSessionViewType>('gallery');
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
    'joined-meeting',
    useCallback(() => {
      setIsJoining(false);
      setError(null);
    }, []),
  );

  useEffect(() => {
    let isActive = true;

    setIsJoining(true);
    setError(null);

    void callObject
      .join({
        url: joinUrl,
        token: token ?? undefined,
      })
      .then(() => {
        if (!isActive) {
          return;
        }
        setIsJoining(false);
      })
      .catch((joinError: unknown) => {
        if (!isActive) {
          return;
        }
        setIsJoining(false);
        setError(getDailyLiveSessionErrorMessage(joinError));
      });

    return () => {
      isActive = false;
      shouldRouteOnLeaveRef.current = false;
      void callObject.leave().catch(() => undefined);
    };
  }, [callObject, joinUrl, token]);

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
    const next = !isScreenSharing;
    if (next) {
      callObject.startScreenShare();
    } else {
      callObject.stopScreenShare();
    }
    setIsScreenSharing(next);
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
    <div className="flex flex-1 flex-col bg-[#151821] px-4 py-4 text-white dark:bg-[#11141b]">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/6 bg-[#1a1e28] shadow-[0_10px_40px_rgba(0,0,0,0.32)] dark:bg-[#171b24]">
        {(isJoining || meetingState !== 'joined-meeting') && !error ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#151821]/80">
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading live session...
            </div>
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#151821]/90 px-6 text-center">
            <div className="space-y-2">
              <p className="text-sm font-medium text-white">Live session unavailable</p>
              <p className="text-sm text-zinc-300">{error}</p>
            </div>
          </div>
        ) : null}

        <div className="mx-auto flex h-full min-h-[60vh] max-w-[1440px] flex-col gap-3 p-3 md:min-h-[62vh] md:gap-4 md:p-4">
          <DailyAudio />

          {!isDirectCall ? (
            <div className="flex justify-end">
              <ViewSwitcher currentView={currentView} onViewChange={setCurrentView} />
            </div>
          ) : null}

          {isSettingsOpen ? (
            <div className="rounded-2xl border border-white/8 bg-[#232735] p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">Session settings</p>
                  <p className="text-xs text-zinc-400">
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
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400">
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
                  <span className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400">
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
                  <span className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400">
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
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400">
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

              <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={isNoiseCancellationEnabled}
                    onCheckedChange={(checked) => void handleToggleNoiseCancellation(checked)}
                    disabled={isApplyingInputSettings}
                  />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-white">Noise cancellation</p>
                    <p className="text-xs text-zinc-400">
                      Reduce room noise on your microphone input.
                    </p>
                  </div>
                </div>

                {isApplyingDevice || isApplyingInputSettings ? (
                  <div className="inline-flex items-center gap-2 text-xs text-zinc-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Applying changes...
                  </div>
                ) : null}

                {isApplyingDevice ? (
                  <div className="text-xs text-zinc-400">
                    Updating {isApplyingDevice.split(':')[0]}...
                  </div>
                ) : null}

                {inputSettingsError ? (
                  <div className="text-xs text-red-300">{inputSettingsError}</div>
                ) : null}
              </div>
            </div>
          ) : null}

          {participantIds.length > 0 ? (
            <div
              className={[
                'min-h-0 flex-1',
                isDirectCall && directCallComposition.useOneToOneLayout
                  ? 'relative'
                  : isDirectCall
                    ? 'grid grid-cols-1 gap-3 md:grid-cols-2'
                    : currentView === 'speaker'
                      ? 'grid grid-cols-1 gap-3'
                    : 'grid grid-cols-1 gap-3 lg:grid-cols-2',
              ].join(' ')}
            >
              {isDirectCall && directCallComposition.useOneToOneLayout ? (
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
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-center">
              <div className="space-y-3 text-zinc-400">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white">Waiting for participants</p>
                  <p className="text-sm">Share the live session message or join link to bring others in.</p>
                </div>
              </div>
            </div>
          )}

          {!localSessionId ? (
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-400">
              <VideoOff className="h-4 w-4" />
              Camera preview will appear after Daily finishes joining the room.
            </div>
          ) : null}
        </div>
      </div>

      <ControlBar
        meetingName={isDirectCall ? 'Direct session' : 'Live session'}
        isMuted={!isMicEnabled}
        isVideoOn={isCameraEnabled}
        isSharing={isScreenSharing}
        isDirectCall={isDirectCall}
        isEnding={isLeaving}
        onToggleMute={handleToggleMic}
        onToggleVideo={handleToggleCamera}
        onToggleShare={handleToggleScreenShare}
        onToggleSettings={() => setIsSettingsOpen((open) => !open)}
        onEndCall={() => void handleLeave()}
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
}: {
  joinUrl: string;
  token?: string | null;
  externalJoinUrl?: string | null;
  channelKind?: string | null;
  mode?: 'video' | 'audio' | null;
  returnPath: string;
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
      />
    </DailyProvider>
  );
}
