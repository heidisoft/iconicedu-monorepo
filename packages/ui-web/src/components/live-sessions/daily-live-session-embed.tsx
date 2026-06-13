'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
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
} from '@daily-co/daily-react';
import type { DailyInputSettings } from '@daily-co/daily-js';
import {
  AudioLines,
  Blend,
  Camera,
  ChevronDown,
  CircleOff,
  CloudFog,
  Loader2,
  Mic,
  MicOff,
  RefreshCw,
  ScanFace,
  Settings,
  Settings2,
  Users,
  Video,
  VideoOff,
  Volume2,
  WandSparkles,
} from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@iconicedu/ui-web/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web/ui/select';
import { Switch } from '@iconicedu/ui-web/ui/switch';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@iconicedu/ui-web/ui/popover';
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
  isDirectLiveSessionLayout,
  isDailyParticipantMicMuted,
  isDailyParticipantSpeaking,
} from '@iconicedu/ui-web/components/live-sessions/daily-live-session-embed.utils';
import { type LiveSessionViewType } from '@iconicedu/ui-web/components/live-sessions/view-switcher';
import { VideoParticipant } from '@iconicedu/ui-web/components/live-sessions/video-participant';

// ─── Pre-join: Permissions card ──────────────────────────────────────────────

function PreJoinPermissionsCard({
  meetingName,
  onRequestPermissions,
}: {
  meetingName?: string | null;
  onRequestPermissions: () => void;
}) {
  return (
    <div className="w-full max-w-[448px] overflow-hidden rounded-[28px] border border-border bg-card shadow-2xl">
      {/* Dark camera-area — mirrors the Figma "no permission" state */}
      <div className="flex aspect-[4/3] items-center justify-center bg-slate-600">
        <div className="flex items-center gap-5">
          <div className="rounded-2xl bg-black/40 p-4 backdrop-blur-sm">
            <Video className="h-7 w-7 text-white" />
          </div>
          <div className="rounded-2xl bg-black/40 p-4 backdrop-blur-sm">
            <Mic className="h-7 w-7 text-white" />
          </div>
        </div>
      </div>
      {/* Content */}
      <div className="space-y-4 p-6">
        <div className="space-y-2">
          <h2 className="text-xl font-bold leading-snug text-foreground">
            Allow Access to Camera and Microphone
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            To connect with {meetingName?.trim() || 'your session'}, your browser needs
            permission to use your camera and microphone. Please click &apos;Request
            permissions&apos; to proceed.
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          className="w-full rounded-2xl"
          onClick={onRequestPermissions}
        >
          Request permissions
        </Button>
      </div>
    </div>
  );
}

// ─── Pre-join: Device setup card (video + controls + dropdowns + join) ────────

export type LinkedChildProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

function PreJoinDeviceSetupCard({
  participant,
  userName,
  userAvatarUrl,
  linkedChildren,
  selectedChildId,
  onSelectChild,
  isCameraEnabled,
  isMicEnabled,
  isPreparingPreview,
  isJoining,
  mode,
  cameras,
  microphones,
  speakers,
  currentCam,
  currentMic,
  currentSpeaker,
  backgroundPreset,
  isNoiseCancellationEnabled,
  onToggleCamera,
  onToggleMic,
  onJoin,
  onSelectCamera,
  onSelectMic,
  onSelectSpeaker,
  onSelectBackgroundPreset,
  onToggleNoiseCancellation,
}: {
  participant:
    | ReturnType<NonNullable<ReturnType<typeof useCallObject>>['participants']>['local']
    | undefined;
  userName?: string | null;
  userAvatarUrl?: string | null;
  linkedChildren?: LinkedChildProfile[];
  selectedChildId?: string | null;
  onSelectChild?: (id: string) => void;
  isCameraEnabled: boolean;
  isMicEnabled: boolean;
  isPreparingPreview: boolean;
  isJoining: boolean;
  mode?: 'video' | 'audio' | null;
  cameras: ReturnType<typeof useDevices>['cameras'];
  microphones: ReturnType<typeof useDevices>['microphones'];
  speakers: ReturnType<typeof useDevices>['speakers'];
  currentCam: ReturnType<typeof useDevices>['currentCam'];
  currentMic: ReturnType<typeof useDevices>['currentMic'];
  currentSpeaker: ReturnType<typeof useDevices>['currentSpeaker'];
  backgroundPreset: string;
  isNoiseCancellationEnabled: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onJoin: () => void;
  onSelectCamera: (id: string) => void;
  onSelectMic: (id: string) => void;
  onSelectSpeaker: (id: string) => void;
  onSelectBackgroundPreset: (preset: string) => void;
  onToggleNoiseCancellation: (enabled: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoTrack = participant?.tracks.video.persistentTrack;
  const audioTrack = participant?.tracks.audio.persistentTrack;

  const hasChildren = linkedChildren && linkedChildren.length > 0;
  const selectedChild = hasChildren
    ? (linkedChildren.find((c) => c.id === selectedChildId) ?? linkedChildren[0]!)
    : null;
  // In the pre-join preview, show the child's identity when joining as a guardian
  const displayName = selectedChild?.displayName ?? userName;
  const displayAvatarUrl = selectedChild?.avatarUrl ?? userAvatarUrl;

  const participantInitials = getDailyParticipantInitials(displayName);
  const showVideo = !!videoTrack && isCameraEnabled;

  const [audioLevel, setAudioLevel] = useState(0);
  useAudioLevel(isMicEnabled ? audioTrack : undefined, setAudioLevel);
  const rawIsSpeaking = isMicEnabled && isDailyParticipantSpeaking(audioLevel);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speakingOffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (rawIsSpeaking) {
      if (speakingOffTimer.current) {
        clearTimeout(speakingOffTimer.current);
        speakingOffTimer.current = null;
      }
      setIsSpeaking(true);
    } else {
      speakingOffTimer.current = setTimeout(() => setIsSpeaking(false), 800);
    }
    return () => {
      if (speakingOffTimer.current) clearTimeout(speakingOffTimer.current);
    };
  }, [rawIsSpeaking]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (videoTrack && isCameraEnabled) {
      const stream = new MediaStream([videoTrack]);
      el.srcObject = stream;
      void el.play().catch(() => undefined);
      return () => {
        el.pause();
        el.srcObject = null;
        stream.getTracks().forEach((t) => t.stop());
      };
    }
    el.pause();
    el.srcObject = null;
    return undefined;
  }, [isCameraEnabled, videoTrack]);

  // Single unified card: video (top, flush with card edges) + white controls (bottom)
  return (
    <div className="w-full overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
      {/* ── Video area — explicit aspect-ratio container so overlay is always inside ── */}
      <div className="relative aspect-4/3 w-full overflow-hidden bg-slate-200 dark:bg-slate-700">
        {isPreparingPreview ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing preview…
            </div>
          </div>
        ) : showVideo ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div
              className={[
                'rounded-full transition-shadow duration-700 ease-in-out',
                isSpeaking ? 'shadow-[0_0_0_4px_rgba(34,197,94,0.85)]' : 'shadow-none',
              ].join(' ')}
            >
              <Avatar className="h-24 w-24">
                {displayAvatarUrl ? (
                  <AvatarImage src={displayAvatarUrl} alt={displayName ?? ''} />
                ) : null}
                <AvatarFallback className="text-2xl">
                  {participantInitials}
                </AvatarFallback>
              </Avatar>
            </div>
            {displayName?.trim() ? (
              <p className="text-sm font-medium text-foreground">{displayName.trim()}</p>
            ) : null}
          </div>
        )}

        {/* Child switcher — top-right of video area (guardian accounts only) */}
        {hasChildren && !isPreparingPreview ? (
          <div className="absolute right-3 top-3 z-30">
            {linkedChildren!.length === 1 ? (
              <div className="flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur-sm">
                <Avatar className="h-5 w-5">
                  {selectedChild?.avatarUrl ? (
                    <AvatarImage src={selectedChild.avatarUrl} alt="" />
                  ) : null}
                  <AvatarFallback className="text-[10px]">
                    {getDailyParticipantInitials(selectedChild?.displayName)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-white">
                  {selectedChild?.displayName}
                </span>
              </div>
            ) : (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur-sm transition-colors hover:bg-black/70"
                  >
                    <Avatar className="h-5 w-5">
                      {selectedChild?.avatarUrl ? (
                        <AvatarImage src={selectedChild.avatarUrl} alt="" />
                      ) : null}
                      <AvatarFallback className="text-[10px]">
                        {getDailyParticipantInitials(selectedChild?.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-white">
                      {selectedChild?.displayName}
                    </span>
                    <ChevronDown className="h-3 w-3 text-white/80" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" className="w-48 gap-0 p-1">
                  {linkedChildren!.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => onSelectChild?.(child.id)}
                      className={[
                        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors',
                        (selectedChildId ?? linkedChildren![0]?.id) === child.id
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-muted',
                      ].join(' ')}
                    >
                      <Avatar className="h-6 w-6 shrink-0">
                        {child.avatarUrl ? (
                          <AvatarImage src={child.avatarUrl} alt="" />
                        ) : null}
                        <AvatarFallback className="text-xs">
                          {getDailyParticipantInitials(child.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{child.displayName}</span>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            )}
          </div>
        ) : null}

        {/* Gradient scrim + overlay buttons at the bottom of the video */}
        {!isPreparingPreview ? (
          <>
            {/* Dark gradient so buttons are readable over any video frame */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-linear-to-t from-black/50 to-transparent" />

            {/* 3-column: [background] [camera|mic] [settings] */}
            <div className="absolute inset-x-0 bottom-0 z-20 grid grid-cols-3 items-center px-4 pb-4">
              {/* Left: Background effects */}
              <div className="flex justify-start">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Background effects"
                      className={[
                        'rounded-xl border border-zinc-600 bg-muted p-2.5 transition-colors hover:bg-muted/80',
                        backgroundPreset !== 'none'
                          ? 'ring-2 ring-white/80 ring-offset-1 ring-offset-transparent'
                          : '',
                      ].join(' ')}
                    >
                      <ScanFace className="h-5 w-5 text-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start">
                    <PopoverHeader>
                      <PopoverTitle>Background</PopoverTitle>
                      <PopoverDescription>
                        Choose a virtual background effect.
                      </PopoverDescription>
                    </PopoverHeader>
                    <div className="flex flex-col gap-1">
                      {(
                        [
                          { value: 'none', label: 'No background', icon: CircleOff },
                          { value: 'blur-soft', label: 'Blur', icon: Blend },
                          { value: 'blur-strong', label: 'Strong blur', icon: CloudFog },
                        ] as const
                      ).map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => onSelectBackgroundPreset(value)}
                          className={[
                            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                            backgroundPreset === value
                              ? 'bg-primary text-primary-foreground'
                              : 'text-foreground hover:bg-muted',
                          ].join(' ')}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Center: Camera + Mic */}
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  aria-label={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
                  onClick={onToggleCamera}
                  className="rounded-xl border border-zinc-600 bg-muted p-2.5 transition-colors hover:bg-muted/80"
                >
                  {isCameraEnabled ? (
                    <Video className="h-5 w-5 text-foreground" />
                  ) : (
                    <VideoOff className="h-5 w-5 text-foreground" />
                  )}
                </button>

                <button
                  type="button"
                  aria-label={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
                  onClick={onToggleMic}
                  className={[
                    'rounded-xl border bg-muted p-2.5 transition-shadow duration-700 ease-in-out hover:bg-muted/80',
                    isSpeaking
                      ? 'border-green-500 shadow-[0_0_0_4px_rgba(34,197,94,0.85)]'
                      : 'border-zinc-600 shadow-none',
                  ].join(' ')}
                >
                  {isMicEnabled ? (
                    <Mic className="h-5 w-5 text-foreground" />
                  ) : (
                    <MicOff className="h-5 w-5 text-foreground" />
                  )}
                </button>
              </div>

              {/* Right: Settings */}
              <div className="flex justify-end">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Audio settings"
                      className="rounded-xl border border-zinc-600 bg-muted p-2.5 transition-colors hover:bg-muted/80"
                    >
                      <Settings className="h-5 w-5 text-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="end">
                    <PopoverHeader>
                      <PopoverTitle>Audio settings</PopoverTitle>
                    </PopoverHeader>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <AudioLines className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-foreground">
                            Noise cancellation
                          </p>
                          <PopoverDescription>Reduce background noise</PopoverDescription>
                        </div>
                      </div>
                      <Switch
                        checked={isNoiseCancellationEnabled}
                        onCheckedChange={onToggleNoiseCancellation}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* ── Card bottom: device selects + join button + disclaimer ── */}
      <div className="space-y-3 p-5">
        {/* Device selects */}
        <div className="space-y-2">
          {mode !== 'audio' ? (
            <Select
              value={currentCam?.device.deviceId ?? ''}
              onValueChange={onSelectCamera}
            >
              <SelectTrigger className="h-12 w-full pl-3.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Video className="h-4 w-4 shrink-0 text-foreground" />
                  <SelectValue placeholder="Select camera" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {cameras.map((cam, i) => (
                  <SelectItem key={cam.device.deviceId} value={cam.device.deviceId}>
                    {getDailyDeviceLabel({
                      label: cam.device.label,
                      kind: cam.device.kind,
                      index: i,
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <Select value={currentMic?.device.deviceId ?? ''} onValueChange={onSelectMic}>
            <SelectTrigger className="h-12 w-full pl-3.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <Mic className="h-4 w-4 shrink-0 text-foreground" />
                <SelectValue placeholder="Select microphone" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {microphones.map((mic, i) => (
                <SelectItem key={mic.device.deviceId} value={mic.device.deviceId}>
                  {getDailyDeviceLabel({
                    label: mic.device.label,
                    kind: mic.device.kind,
                    index: i,
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={currentSpeaker?.device.deviceId ?? ''}
            onValueChange={onSelectSpeaker}
          >
            <SelectTrigger className="h-12 w-full pl-3.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <Volume2 className="h-4 w-4 shrink-0 text-foreground" />
                <SelectValue placeholder="Select speaker" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {speakers.map((spk, i) => (
                <SelectItem key={spk.device.deviceId} value={spk.device.deviceId}>
                  {getDailyDeviceLabel({
                    label: spk.device.label,
                    kind: spk.device.kind,
                    index: i,
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Join */}
        <Button
          type="button"
          size="lg"
          className="w-full text-base font-semibold"
          onClick={onJoin}
          disabled={isPreparingPreview || isJoining}
        >
          {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Join meeting
        </Button>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          This session may be recorded for quality and learning purposes. Recordings are
          never shared with third parties.
        </p>
      </div>
    </div>
  );
}

// ─── In-call participant tiles ────────────────────────────────────────────────

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
  const rawIsSpeaking = isDailyParticipantSpeaking(audioLevel);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speakingOffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (rawIsSpeaking) {
      if (speakingOffTimer.current) {
        clearTimeout(speakingOffTimer.current);
        speakingOffTimer.current = null;
      }
      setIsSpeaking(true);
    } else {
      speakingOffTimer.current = setTimeout(() => setIsSpeaking(false), 800);
    }
    return () => {
      if (speakingOffTimer.current) clearTimeout(speakingOffTimer.current);
    };
  }, [rawIsSpeaking]);
  const isMicMuted = isDailyParticipantMicMuted({
    audioState: participant?.tracks.audio.state,
  });
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
            isFloating ? 'min-h-32' : 'min-h-44 md:min-h-[200px]',
          ].join(' ')}
        />
      ) : undefined}
    </VideoParticipant>
  );
}

function DailyScreenShareTile({ sessionId }: { sessionId: string }) {
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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-background/95 to-transparent px-4 py-3">
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
          <p className="truncate text-sm font-medium text-foreground">
            {participantLabel}
          </p>
          <p className="text-xs text-muted-foreground">
            {isLocal ? 'You' : 'Participant'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {isCameraOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
      </div>
    </div>
  );
}

// ─── Main surface ─────────────────────────────────────────────────────────────

function DailyLiveSessionSurface({
  callObject,
  joinUrl,
  token,
  // externalJoinUrl kept in signature for API compatibility but no longer used in-surface
  externalJoinUrl: _externalJoinUrl,
  channelKind,
  mode,
  returnPath,
  meetingName,
  userName,
  userAvatarUrl,
  linkedChildren,
  liveSessionId,
  channelId,
  whiteboardEnabled,
  panelMode,
  onPanelModeChange,
  onJoined,
  onLeave,
}: {
  callObject: NonNullable<ReturnType<typeof useCallObject>>;
  joinUrl: string;
  token?: string | null;
  externalJoinUrl?: string | null;
  channelKind?: string | null;
  mode?: 'video' | 'audio' | null;
  returnPath: string;
  meetingName?: string | null;
  userName?: string | null;
  userAvatarUrl?: string | null;
  linkedChildren?: LinkedChildProfile[];
  liveSessionId?: string | null;
  channelId?: string | null;
  whiteboardEnabled?: boolean;
  panelMode?: import('@iconicedu/shared-types').WhiteboardPanelMode;
  onPanelModeChange?: (
    mode: import('@iconicedu/shared-types').WhiteboardPanelMode,
  ) => void;
  onJoined?: () => void;
  onLeave: (path: string) => void;
}) {
  const localSessionId = useLocalSessionId();
  const remoteParticipantIds = useParticipantIds({ filter: 'remote' });
  const participantCounts = useParticipantCounts();
  const meetingState = useMeetingState();
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
  const {
    inputSettings,
    updateInputSettings,
    errorMsg: inputSettingsError,
  } = useInputSettings();

  const [selectedChildId, setSelectedChildId] = useState<string | null>(
    linkedChildren?.[0]?.id ?? null,
  );

  const [error, setError] = useState<string | null>(null);
  const [permissionsBlocked, setPermissionsBlocked] = useState(false);
  const [isPreparingPreview, setIsPreparingPreview] = useState(true);
  const [hasStartedJoin, setHasStartedJoin] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isRefreshingDevices, setIsRefreshingDevices] = useState(false);
  const [isApplyingDevice, setIsApplyingDevice] = useState<string | null>(null);
  const [isApplyingInputSettings, setIsApplyingInputSettings] = useState(false);
  const [currentView, setCurrentView] = useState<LiveSessionViewType>('gallery');
  const [isRecording, setIsRecording] = useState(false);
  const [isTogglingRecording, setIsTogglingRecording] = useState(false);
  const [, forceParticipantTrackRefresh] = useReducer((value: number) => value + 1, 0);

  const shouldRouteOnLeaveRef = useRef(true);
  const isDirectCall = isDirectLiveSessionLayout({ channelKind, mode });
  const backgroundPreset = getDailyBackgroundPresetValue({
    processor: inputSettings?.video?.processor ?? null,
  });
  const isNoiseCancellationEnabled =
    inputSettings?.audio?.processor?.type === 'noise-cancellation';

  const handleLeftMeeting = useCallback(() => {
    if (!shouldRouteOnLeaveRef.current) return;
    onLeave(returnPath);
  }, [returnPath, onLeave]);

  const handleError = useCallback((event: { errorMsg?: string } | undefined) => {
    setIsJoining(false);
    setError(event?.errorMsg ?? 'Failed to join live session');
  }, []);

  useDailyEvent('left-meeting', handleLeftMeeting);
  useDailyEvent('error', handleError);
  useDailyEvent(
    'participant-updated',
    useCallback(() => forceParticipantTrackRefresh(), []),
  );
  useDailyEvent(
    'participant-joined',
    useCallback(() => forceParticipantTrackRefresh(), []),
  );
  useDailyEvent(
    'participant-left',
    useCallback(() => forceParticipantTrackRefresh(), []),
  );
  useDailyEvent(
    'local-screen-share-started',
    useCallback(() => {
      forceParticipantTrackRefresh();
      setCurrentView('shared-content');
    }, []),
  );
  useDailyEvent(
    'local-screen-share-stopped',
    useCallback(() => {
      forceParticipantTrackRefresh();
      setCurrentView((v) => (v === 'shared-content' ? 'gallery' : v));
    }, []),
  );
  useDailyEvent(
    'track-started',
    useCallback(() => forceParticipantTrackRefresh(), []),
  );
  useDailyEvent(
    'joined-meeting',
    useCallback(() => {
      setIsJoining(false);
      setIsPreparingPreview(false);
      setHasStartedJoin(true);
      setError(null);
      forceParticipantTrackRefresh();
      onJoined?.();
      // onJoined is a stable ref from the parent — safe to omit
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // Start camera preview on mount
  useEffect(() => {
    let isActive = true;
    setIsPreparingPreview(true);
    setError(null);
    setPermissionsBlocked(false);

    void callObject
      .startCamera()
      .then(() => {
        if (!isActive) return;
        setIsPreparingPreview(false);
        forceParticipantTrackRefresh();
      })
      .catch((previewError: unknown) => {
        if (!isActive) return;
        setIsPreparingPreview(false);
        const errMsg = getDailyLiveSessionErrorMessage(previewError);
        const errStr = String(previewError).toLowerCase();
        if (
          errStr.includes('notallowed') ||
          errStr.includes('not allowed') ||
          errStr.includes('permission') ||
          errMsg.toLowerCase().includes('permission')
        ) {
          setPermissionsBlocked(true);
        } else {
          setError(errMsg);
        }
      });

    return () => {
      isActive = false;
      shouldRouteOnLeaveRef.current = false;
      void callObject.leave().catch(() => undefined);
    };
  }, [callObject]);

  // Auto-select the first available device if Daily hasn't set a default
  useEffect(() => {
    if (isPreparingPreview) return;
    if (!currentCam && cameras.length > 0) {
      void setCamera(cameras[0]!.device.deviceId);
    }
    if (!currentMic && microphones.length > 0) {
      void setMicrophone(microphones[0]!.device.deviceId);
    }
    if (!currentSpeaker && speakers.length > 0) {
      void setSpeaker(speakers[0]!.device.deviceId);
    }
  }, [
    isPreparingPreview,
    cameras,
    microphones,
    speakers,
    currentCam,
    currentMic,
    currentSpeaker,
    setCamera,
    setMicrophone,
    setSpeaker,
  ]);

  // Request camera/mic permissions then retry startCamera
  const handleRequestPermissions = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setPermissionsBlocked(false);
      setError(null);
      setIsPreparingPreview(true);
      await callObject.startCamera();
      setIsPreparingPreview(false);
      forceParticipantTrackRefresh();
    } catch (err: unknown) {
      setIsPreparingPreview(false);
      setError(getDailyLiveSessionErrorMessage(err));
    }
  };

  const handleLeave = async () => {
    if (isLeaving) return;
    shouldRouteOnLeaveRef.current = true;
    setIsLeaving(true);
    try {
      await callObject.leave();
    } catch {
      onLeave(returnPath);
    } finally {
      setIsLeaving(false);
    }
  };

  const handleJoinMeeting = async () => {
    if (isJoining) return;
    setHasStartedJoin(true);
    setIsJoining(true);
    setError(null);
    try {
      await callObject.join({ url: joinUrl, token: token ?? undefined });
    } catch (joinError: unknown) {
      setIsJoining(false);
      setError(getDailyLiveSessionErrorMessage(joinError));
    }
  };

  const participantIds = useMemo(
    () => buildDailyParticipantIds({ localSessionId, remoteParticipantIds }),
    [localSessionId, remoteParticipantIds],
  );
  const directCallComposition = useMemo(
    () => buildDailyDirectCallComposition({ localSessionId, remoteParticipantIds }),
    [localSessionId, remoteParticipantIds],
  );

  const activeScreenShareSessionId = (() => {
    const participants = callObject.participants();
    for (const sessionId of participantIds) {
      if (participants[sessionId]?.tracks.screenVideo.state === 'playable') {
        return sessionId;
      }
    }
    return null;
  })();

  const isScreenSharing = (() => {
    if (!localSessionId) return false;
    return (
      callObject.participants()[localSessionId]?.tracks.screenVideo.state === 'playable'
    );
  })();

  const stageParticipantIds = useMemo(
    () => participantIds.filter((id) => id !== activeScreenShareSessionId),
    [activeScreenShareSessionId, participantIds],
  );

  const localParticipant = useParticipant(localSessionId ?? undefined);
  const isHandRaised = Boolean(
    localParticipant &&
    typeof localParticipant.userData === 'object' &&
    localParticipant.userData !== null &&
    'raisedHand' in localParticipant.userData &&
    localParticipant.userData.raisedHand,
  );

  const applyInputSettings = useCallback(
    async (nextInputSettings: DailyInputSettings) => {
      if (!updateInputSettings) return;
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
      setCurrentView((v) => (v === 'shared-content' ? 'gallery' : v));
    }
  };

  const handleToggleRaiseHand = async () => {
    const currentUserData =
      localParticipant &&
      typeof localParticipant.userData === 'object' &&
      localParticipant.userData !== null
        ? localParticipant.userData
        : {};
    try {
      await callObject.setUserData({ ...currentUserData, raisedHand: !isHandRaised });
      forceParticipantTrackRefresh();
    } catch (err: unknown) {
      setError(getDailyLiveSessionErrorMessage(err));
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
    if (!deviceId) return;
    setIsApplyingDevice(`${kind}:${deviceId}`);
    try {
      if (kind === 'camera') await setCamera(deviceId);
      else if (kind === 'microphone') await setMicrophone(deviceId);
      else await setSpeaker(deviceId);
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

  const handleToggleRecording = async () => {
    if (isTogglingRecording || !liveSessionId || !channelId) return;
    setIsTogglingRecording(true);
    try {
      const res = await fetch(
        `/api/channels/${channelId}/live-sessions/${liveSessionId}/recording`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: isRecording ? 'stop' : 'start' }),
        },
      );
      if (res.ok) setIsRecording((prev) => !prev);
    } catch {
      // Leave recording state unchanged on network error
    } finally {
      setIsTogglingRecording(false);
    }
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
    <div className="flex min-h-0 flex-1 flex-col bg-background text-foreground">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* REC indicator */}
        {isRecording ? (
          <div className="pointer-events-none absolute right-4 top-4 z-30 flex items-center gap-1.5 rounded-full bg-destructive/90 px-2.5 py-1 text-xs font-medium text-destructive-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            REC
          </div>
        ) : null}

        {/* Joining overlay */}
        {isJoining && !error ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/85">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Joining live session…
            </div>
          </div>
        ) : null}

        {/* Generic error overlay (not shown when permissions card is visible) */}
        {error && !permissionsBlocked ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 px-6 text-center">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Live session unavailable
              </p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : null}

        <div className="mx-auto flex h-full max-w-[1440px] flex-col gap-3 p-3 md:gap-4 md:p-4">
          <DailyAudio />

          {/* ── Pre-join screen ── */}
          {!hasStartedJoin && meetingState !== 'joined-meeting' ? (
            <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-6">
              <div className="w-full max-w-md space-y-4">
                {/* Class title */}
                {meetingName?.trim() ? (
                  <div className="space-y-0.5 text-center">
                    <h1 className="text-xl font-semibold tracking-tight text-foreground">
                      {meetingName.trim()}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Check your setup before joining
                    </p>
                  </div>
                ) : null}

                {permissionsBlocked ? (
                  <PreJoinPermissionsCard
                    meetingName={meetingName}
                    onRequestPermissions={() => void handleRequestPermissions()}
                  />
                ) : (
                  <PreJoinDeviceSetupCard
                    participant={localParticipant ?? undefined}
                    userName={userName}
                    userAvatarUrl={userAvatarUrl}
                    linkedChildren={linkedChildren}
                    selectedChildId={selectedChildId}
                    onSelectChild={setSelectedChildId}
                    isCameraEnabled={isCameraEnabled}
                    isMicEnabled={isMicEnabled}
                    isPreparingPreview={isPreparingPreview}
                    isJoining={isJoining}
                    mode={mode}
                    cameras={cameras}
                    microphones={microphones}
                    speakers={speakers}
                    currentCam={currentCam}
                    currentMic={currentMic}
                    currentSpeaker={currentSpeaker}
                    backgroundPreset={backgroundPreset}
                    isNoiseCancellationEnabled={isNoiseCancellationEnabled}
                    onToggleCamera={handleToggleCamera}
                    onToggleMic={handleToggleMic}
                    onJoin={() => void handleJoinMeeting()}
                    onSelectCamera={(id) => void handleSelectDevice('camera', id)}
                    onSelectMic={(id) => void handleSelectDevice('microphone', id)}
                    onSelectSpeaker={(id) => void handleSelectDevice('speaker', id)}
                    onSelectBackgroundPreset={(preset) =>
                      void handleSelectBackgroundPreset(preset)
                    }
                    onToggleNoiseCancellation={(enabled) =>
                      void handleToggleNoiseCancellation(enabled)
                    }
                  />
                )}
              </div>
            </div>
          ) : null}

          {/* ── Participants panel ── */}
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

          {/* ── Settings panel (used for background / noise-cancellation / advanced devices) ── */}
          {isSettingsOpen ? (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Session settings</p>
                  <p className="text-xs text-muted-foreground">
                    Choose your devices and effects for this session.
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
                          <SelectItem
                            key={camera.device.deviceId}
                            value={camera.device.deviceId}
                          >
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
                    onValueChange={(value) =>
                      void handleSelectDevice('microphone', value)
                    }
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
                        <SelectItem
                          key={speaker.device.deviceId}
                          value={speaker.device.deviceId}
                        >
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
                    onCheckedChange={(checked) =>
                      void handleToggleNoiseCancellation(checked)
                    }
                    disabled={isApplyingInputSettings}
                  />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">
                      Noise cancellation
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Reduce room noise on your microphone input.
                    </p>
                  </div>
                </div>

                {isApplyingDevice || isApplyingInputSettings ? (
                  <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Applying changes…
                  </div>
                ) : null}

                {inputSettingsError ? (
                  <div className="text-xs text-destructive">{inputSettingsError}</div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* ── In-call: participant video grid ── */}
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
                      isLocal={
                        directCallComposition.primaryParticipantId === localSessionId
                      }
                    />
                  ) : null}
                  {directCallComposition.floatingParticipantId ? (
                    <div className="absolute bottom-3 right-3 z-10 w-[22vw] min-w-36 max-w-52 md:bottom-4 md:right-4">
                      <DailyParticipantTile
                        key={directCallComposition.floatingParticipantId}
                        sessionId={directCallComposition.floatingParticipantId}
                        isLocal={
                          directCallComposition.floatingParticipantId === localSessionId
                        }
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
                  <p className="text-sm font-medium text-foreground">
                    Waiting for participants
                  </p>
                  <p className="text-sm">
                    Share the live session message or join link to bring others in.
                  </p>
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
    </div>
  );
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function DailyLiveSessionEmbed({
  joinUrl,
  token,
  externalJoinUrl,
  channelKind,
  mode,
  returnPath,
  meetingName,
  userName,
  userAvatarUrl,
  linkedChildren,
  liveSessionId,
  channelId,
  whiteboardEnabled,
  panelMode,
  onPanelModeChange,
  onJoined,
  onLeave,
}: {
  joinUrl: string;
  token?: string | null;
  externalJoinUrl?: string | null;
  channelKind?: string | null;
  mode?: 'video' | 'audio' | null;
  returnPath: string;
  meetingName?: string | null;
  userName?: string | null;
  userAvatarUrl?: string | null;
  linkedChildren?: LinkedChildProfile[];
  liveSessionId?: string | null;
  channelId?: string | null;
  whiteboardEnabled?: boolean;
  panelMode?: import('@iconicedu/shared-types').WhiteboardPanelMode;
  onPanelModeChange?: (
    mode: import('@iconicedu/shared-types').WhiteboardPanelMode,
  ) => void;
  onJoined?: () => void;
  onLeave: (path: string) => void;
}) {
  const callObject = useCallObject({
    options: {
      startAudioOff: true,
      startVideoOff: true,
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
        userName={userName}
        userAvatarUrl={userAvatarUrl}
        linkedChildren={linkedChildren}
        liveSessionId={liveSessionId}
        channelId={channelId}
        whiteboardEnabled={whiteboardEnabled}
        panelMode={panelMode}
        onPanelModeChange={onPanelModeChange}
        onJoined={onJoined}
        onLeave={onLeave}
      />
    </DailyProvider>
  );
}
