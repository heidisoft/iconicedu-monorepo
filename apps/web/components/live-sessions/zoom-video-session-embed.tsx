'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ZoomVideo, {
  AnnotationClearType,
  AnnotationToolType,
  RecordingStatus,
  VideoQuality,
  WhiteboardStatus,
} from '@zoom/videosdk';
import {
  Angry,
  ArrowUpRight,
  Circle,
  Columns2,
  Download,
  Eraser,
  Frown,
  Highlighter,
  Image as ImageIcon,
  ImageOff,
  Laugh,
  LayoutGrid,
  Loader2,
  Meh,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  PenTool,
  Pencil,
  PhoneOff,
  Redo2,
  Send,
  Settings as SettingsIcon,
  Smile,
  Trash2,
  Undo2,
  Users as UsersIcon,
  Video,
  VideoOff,
  X,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@iconicedu/ui-web/ui/avatar';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@iconicedu/ui-web/ui/dialog';
import { Input } from '@iconicedu/ui-web/ui/input';
import { Label } from '@iconicedu/ui-web/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@iconicedu/ui-web/ui/popover';
import { RadioGroup, RadioGroupItem } from '@iconicedu/ui-web/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web/ui/select';
import { Separator } from '@iconicedu/ui-web/ui/separator';
import { Switch } from '@iconicedu/ui-web/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@iconicedu/ui-web/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@iconicedu/ui-web/ui/tooltip';
import { cn, getInitials } from '@iconicedu/ui-web/lib/utils';
import { submitLiveSessionFeedback } from '@iconicedu/web/lib/live-sessions/public-api';

type ZoomClient = ReturnType<typeof ZoomVideo.createClient>;
type MediaDeviceOption = { label: string; deviceId: string };
type ChatMessageItem = {
  id: string;
  senderUserId: number;
  senderName: string;
  message: string;
  timestamp: number;
};
type SidePanel = 'chat' | 'users' | null;
type ViewMode = 'speaker' | 'sideBySide';
type AudioProcessingMode = 'original' | 'noiseSuppression';
type BackgroundPreset = 'none' | 'blur' | 'classroom' | 'study';

const MIRROR_VIDEO_STORAGE_KEY = 'iconicedu:zoom-session:mirror-video';

// Reuses the same branded preset images as the Daily embed's virtual
// background picker (daily-live-session-embed.utils.ts) for consistency
// across providers, rather than shipping a second, Zoom-only asset set.
const BACKGROUND_PRESETS: Array<{
  value: Exclude<BackgroundPreset, 'none' | 'blur'>;
  label: string;
  src: string;
}> = [
  {
    value: 'classroom',
    label: 'Classroom',
    src: '/live-session-backgrounds/classroom.svg',
  },
  { value: 'study', label: 'Study', src: '/live-session-backgrounds/study.svg' },
];

const ANNOTATION_COLORS: Array<{ label: string; value: number }> = [
  { label: 'Red', value: 0xffff0000 },
  { label: 'Yellow', value: 0xffffd60a },
  { label: 'Green', value: 0xff22c55e },
  { label: 'Blue', value: 0xff3b82f6 },
  { label: 'Black', value: 0xff000000 },
];

type RemoteParticipant = {
  userId: number;
  displayName: string;
  muted: boolean;
  bVideoOn: boolean;
  isHost: boolean;
};

async function attachCameraTile(
  client: ZoomClient,
  userId: number,
  container: HTMLElement,
) {
  try {
    const element = await client
      .getMediaStream()
      .attachVideo(userId, VideoQuality.Video_360P);
    if (!(element instanceof HTMLElement)) {
      return;
    }
    element.setAttribute('data-zoom-user-id', String(userId));
    element.className = 'h-full w-full object-cover';
    container.replaceChildren(element);
  } catch {
    // Best effort — the tile just won't render for this participant.
  }
}

async function detachCameraTile(
  client: ZoomClient,
  userId: number,
  container: HTMLElement,
) {
  try {
    await client.getMediaStream().detachVideo(userId);
  } catch {
    // Already gone.
  } finally {
    container.replaceChildren();
  }
}

// Explicitly stop presenting/viewing before leaving the session — an abrupt
// client.leave() still ends the session, but a clean stop lets peers receive
// the 'Stop' event right away instead of waiting on it to time out.
async function leaveWhiteboardCleanly(client: ZoomClient, selfUserId: number | null) {
  const whiteboardClient = client.getWhiteboardClient();
  const presenter = whiteboardClient.getWhiteboardPresenter();
  if (!presenter) {
    return;
  }
  if (presenter.userId === selfUserId) {
    await whiteboardClient.stopWhiteboardScreen().catch(() => null);
  } else {
    await whiteboardClient.stopWhiteboardView().catch(() => null);
  }
}

// Some Zoom Video SDK calls resolve with `'' | ExecutedFailure` instead of
// rejecting on failure. client.join() in particular does NOT follow that
// pattern in practice — on success it resolves with the local Participant
// object (avatar, bVideoOn, muted, ...), not ''. So only treat a resolved
// value as a failure when it actually has the ExecutedFailure shape, or a
// successful join gets misreported as an error.
function isZoomExecutedFailure(
  value: unknown,
): value is { type?: unknown; reason: string; errorCode?: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).reason === 'string'
  );
}

function describeZoomFailure(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object') {
    const candidate = error as { reason?: unknown; type?: unknown; message?: unknown };
    if (typeof candidate.reason === 'string') {
      return candidate.reason;
    }
    if (typeof candidate.type === 'string') {
      return candidate.type;
    }
    if (typeof candidate.message === 'string') {
      return candidate.message;
    }
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return 'Failed to join session';
}

// Safe best-effort dump for on-page display during setup/testing — avoids
// needing the browser DevTools console, which has repeatedly been missed.
function dumpZoomFailure(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`;
  }
  try {
    const seen = new WeakSet();
    return JSON.stringify(
      error,
      (_key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[circular]';
          }
          seen.add(value);
        }
        return value;
      },
      2,
    );
  } catch {
    return String(error);
  }
}

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function formatClockTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function annotationColorToHex(value: number) {
  return `#${value.toString(16).padStart(8, '0').slice(2)}`;
}

function OverlayBadge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full bg-popover/90 px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-sm backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

function IconToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            'flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-popover-foreground transition-colors hover:bg-accent',
            active && 'bg-accent text-accent-foreground',
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function VideoTile({
  label,
  isSelf,
  isMuted,
  isVideoOn,
  videoContainerRef,
  className,
}: {
  label: string;
  isSelf: boolean;
  isMuted: boolean;
  isVideoOn: boolean;
  videoContainerRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-muted', className)}>
      <div
        ref={videoContainerRef}
        // Mirroring (self-view only) is applied via the SDK's own
        // mirrorVideo() — see toggleMirror() — rather than a CSS transform,
        // so it's consistent with Zoom's "Mirror my video" setting and only
        // affects local rendering, never the captured/transmitted track.
        className="h-full w-full [&>video-player]:h-full [&>video-player]:w-full"
      />
      {!isVideoOn ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Avatar size="lg">
            <AvatarFallback>{getInitials(label)}</AvatarFallback>
          </Avatar>
        </div>
      ) : null}
      <OverlayBadge className="absolute bottom-2 left-2">
        {isMuted ? <MicOff className="h-3 w-3" /> : null}
        <span>
          {label}
          {isSelf ? ' (You)' : ''}
        </span>
      </OverlayBadge>
    </div>
  );
}

function DeviceSelect({
  label,
  devices,
  selectedId,
  onChange,
}: {
  label: string;
  devices: MediaDeviceOption[];
  selectedId: string | null;
  onChange: (deviceId: string) => void;
}) {
  if (devices.length === 0) {
    return null;
  }
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <Select value={selectedId ?? undefined} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={`Choose ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {devices.map((device) => (
            <SelectItem key={device.deviceId} value={device.deviceId}>
              {device.label || device.deviceId}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ZoomVideoSessionEmbed({
  sessionName,
  token,
  displayName,
  initialMuted,
  initialVideoOff,
  onLeave,
  liveSessionId,
  accessToken,
}: {
  sessionName: string;
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
}) {
  const clientRef = useRef<ZoomClient | null>(null);
  const selfUserIdRef = useRef<number | null>(null);
  const otherParticipantRef = useRef<RemoteParticipant | null>(null);
  const selfVideoRef = useRef<HTMLDivElement | null>(null);
  const mainVideoRef = useRef<HTMLDivElement | null>(null);
  const shareCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // startShareScreen accepts HTMLCanvasElement | HTMLVideoElement, but the
  // SDK logs "Use Video element instead of Canvas element when WebCodecs
  // enabled" (and the share otherwise fails to render) on browsers where
  // WebCodecs is available — a <video> element works on both.
  const localShareVideoRef = useRef<HTMLVideoElement | null>(null);
  const whiteboardContainerRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const activePanelRef = useRef<SidePanel>(null);

  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>(
    'connecting',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [activeShareUserId, setActiveShareUserId] = useState<number | null>(null);
  const [otherParticipant, setOtherParticipant] = useState<RemoteParticipant | null>(
    null,
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotationTool, setAnnotationTool] = useState(AnnotationToolType.Pen);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [showRecordingBanner, setShowRecordingBanner] = useState(false);
  const [isSelfHost, setIsSelfHost] = useState(false);
  const [hasAcknowledgedRecording, setHasAcknowledgedRecording] = useState(false);
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const [hasLeft, setHasLeft] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [activePanel, setActivePanel] = useState<SidePanel>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [cameraList, setCameraList] = useState<MediaDeviceOption[]>([]);
  const [micList, setMicList] = useState<MediaDeviceOption[]>([]);
  const [speakerList, setSpeakerList] = useState<MediaDeviceOption[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [activeMicId, setActiveMicId] = useState<string | null>(null);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [supportsVirtualBackground, setSupportsVirtualBackground] = useState(false);
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
  const [isShareLocked, setIsShareLocked] = useState(false);
  const [hwAccelEncode, setHwAccelEncode] = useState(true);
  const [hwAccelDecode, setHwAccelDecode] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('sideBySide');
  const [whiteboardStatus, setWhiteboardStatus] = useState<WhiteboardStatus>(
    WhiteboardStatus.Closed,
  );
  const [isPresentingWhiteboard, setIsPresentingWhiteboard] = useState(false);
  const [supportsWhiteboard, setSupportsWhiteboard] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const controlsHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Updates the ref synchronously alongside state, rather than via a
  // separate effect that only runs after commit (a tick later). Event
  // handlers below read otherParticipantRef.current to decide whether a
  // second participant should be recorded; a one-tick-stale ref let two
  // back-to-back 'user-added' events both see null and both "win".
  const updateOtherParticipant = useCallback(
    (
      update:
        | RemoteParticipant
        | null
        | ((previous: RemoteParticipant | null) => RemoteParticipant | null),
    ) => {
      setOtherParticipant((previous) => {
        const next = typeof update === 'function' ? update(previous) : update;
        otherParticipantRef.current = next;
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    activePanelRef.current = activePanel;
    if (activePanel === 'chat') {
      setUnreadChatCount(0);
    }
  }, [activePanel]);

  useEffect(() => {
    if (status !== 'connected') {
      return;
    }
    const interval = setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (recordingStatus !== RecordingStatus.Recording) {
      // Re-arms consent for the next recording instance, if the host stops
      // and later restarts recording within the same session.
      setHasAcknowledgedRecording(false);
      return;
    }
    setShowRecordingBanner(true);
    const timeout = setTimeout(() => setShowRecordingBanner(false), 5000);
    return () => clearTimeout(timeout);
  }, [recordingStatus]);

  useEffect(() => {
    if (activeShareUserId === null && isAnnotating) {
      setIsAnnotating(false);
    }
  }, [activeShareUserId, isAnnotating]);

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
    if (isVideoOn && selfId !== null && selfVideoRef.current) {
      void attachCameraTile(client, selfId, selfVideoRef.current);
    }
    if (otherParticipant?.bVideoOn && mainVideoRef.current) {
      void attachCameraTile(client, otherParticipant.userId, mainVideoRef.current);
    }
  }, [
    status,
    viewMode,
    activeShareUserId,
    whiteboardStatus,
    otherParticipant?.userId,
    otherParticipant?.bVideoOn,
    isVideoOn,
  ]);

  // Floating control bar auto-hides after a few seconds of no mouse/keyboard
  // activity (like a video player's controls), and reappears on the next
  // movement. It keeps its normal responsive sizing/wrapping at every
  // viewport width — there's no separate manual "minimize" state.
  useEffect(() => {
    // Don't let the bar fade out from under an open settings popover or
    // chat/users panel just because the mouse happens to sit still while
    // the user reads it — the popover itself is portaled elsewhere in the
    // DOM, so it wouldn't disappear, but its trigger button would.
    if (isSettingsOpen || activePanel) {
      setIsControlsVisible(true);
      if (controlsHideTimerRef.current) {
        clearTimeout(controlsHideTimerRef.current);
      }
      return;
    }
    const CONTROLS_HIDE_DELAY_MS = 3500;
    const handleActivity = () => {
      setIsControlsVisible(true);
      if (controlsHideTimerRef.current) {
        clearTimeout(controlsHideTimerRef.current);
      }
      controlsHideTimerRef.current = setTimeout(
        () => setIsControlsVisible(false),
        CONTROLS_HIDE_DELAY_MS,
      );
    };
    handleActivity();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('keydown', handleActivity);
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      if (controlsHideTimerRef.current) {
        clearTimeout(controlsHideTimerRef.current);
      }
    };
  }, [isSettingsOpen, activePanel]);

  useEffect(() => {
    let cancelled = false;
    const client = ZoomVideo.createClient();
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

    const handleUserAdded = (payload: Array<{ userId: number; displayName: string }>) => {
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
      const candidate = payload.find((user) => user.userId !== selfId);
      if (candidate && !otherParticipantRef.current) {
        updateOtherParticipant({
          userId: candidate.userId,
          displayName: candidate.displayName,
          muted: false,
          bVideoOn: false,
          isHost: false,
        });
      }
    };

    const handleUserRemoved = (payload: Array<{ userId: number }>) => {
      const current = otherParticipantRef.current;
      if (current && payload.some((user) => user.userId === current.userId)) {
        if (mainVideoRef.current) {
          mainVideoRef.current.replaceChildren();
        }
        updateOtherParticipant(null);
      }
    };

    const handleUserUpdated = (
      payload: Array<{
        userId: number;
        muted?: boolean;
        bVideoOn?: boolean;
        isHost?: boolean;
      }>,
    ) => {
      const current = otherParticipantRef.current;
      if (!current) {
        return;
      }
      const update = payload.find((user) => user.userId === current.userId);
      if (!update) {
        return;
      }
      updateOtherParticipant((previous) =>
        previous
          ? {
              ...previous,
              muted: update.muted ?? previous.muted,
              bVideoOn: update.bVideoOn ?? previous.bVideoOn,
              isHost: update.isHost ?? previous.isHost,
            }
          : previous,
      );
    };

    const handlePeerVideoStateChange = (payload: {
      action: 'Start' | 'Stop';
      userId: number;
    }) => {
      const selfId = selfUserIdRef.current;
      const isSelf = payload.userId === selfId;
      const container = isSelf ? selfVideoRef.current : mainVideoRef.current;
      if (!container) {
        return;
      }
      if (payload.action === 'Start') {
        void attachCameraTile(client, payload.userId, container);
      } else {
        void detachCameraTile(client, payload.userId, container);
      }
      if (isSelf) {
        setIsVideoOn(payload.action === 'Start');
      } else {
        updateOtherParticipant((previous) =>
          previous ? { ...previous, bVideoOn: payload.action === 'Start' } : previous,
        );
      }
    };

    const handleActiveShareChange = (payload: {
      state: 'Active' | 'Inactive';
      userId: number;
    }) => {
      const selfId = selfUserIdRef.current;
      if (payload.state === 'Active') {
        setActiveShareUserId(payload.userId);
        if (payload.userId !== selfId && shareCanvasRef.current) {
          void client
            .getMediaStream()
            .startShareView(shareCanvasRef.current, payload.userId);
        }
      } else {
        setActiveShareUserId(null);
        if (payload.userId !== selfId) {
          void client
            .getMediaStream()
            .detachShareView(payload.userId)
            .catch(() => null);
        }
      }
    };

    // If the other side starts annotating while I'm the one sharing, Zoom
    // requires the presenter to also call startAnnotation() before the
    // viewer's drawing is actually let through — auto-approve it.
    const handleAnnotationViewerDrawRequest = () => {
      void client.getMediaStream().startAnnotation();
    };

    const handleRecordingChange = (recordingStatusPayload: RecordingStatus) => {
      setRecordingStatus(recordingStatusPayload);
    };

    const handleWhiteboardStatusChange = (status: WhiteboardStatus) => {
      setWhiteboardStatus(status);
      if (status === WhiteboardStatus.Closed) {
        setIsPresentingWhiteboard(false);
      }
    };

    // Mirrors the SDK's own documented pattern for this event (see
    // event_peer_whiteboard_state_change's JSDoc example): when someone else
    // starts presenting, auto-join as a viewer; when they stop, leave.
    const handlePeerWhiteboardStateChange = (payload: {
      action: 'Start' | 'Stop';
      userId: number;
    }) => {
      const selfId = selfUserIdRef.current;
      if (payload.userId === selfId) {
        return;
      }
      const whiteboardClient = client.getWhiteboardClient();
      if (payload.action === 'Start') {
        if (whiteboardContainerRef.current) {
          void whiteboardClient.startWhiteboardView(
            whiteboardContainerRef.current,
            payload.userId,
          );
        }
      } else {
        void whiteboardClient.stopWhiteboardView();
      }
    };

    const handleChatMessage = (payload: {
      id?: string;
      message?: string;
      sender: { userId: number; name: string };
      timestamp: number;
    }) => {
      if (!payload.message) {
        return;
      }
      setChatMessages((previous) => [
        ...previous,
        {
          id: payload.id ?? `${payload.sender.userId}-${payload.timestamp}`,
          senderUserId: payload.sender.userId,
          senderName: payload.sender.name,
          message: payload.message as string,
          timestamp: payload.timestamp,
        },
      ]);
      if (activePanelRef.current !== 'chat') {
        setUnreadChatCount((count) => count + 1);
      }
    };

    const handleDeviceChange = () => refreshDeviceLists();

    client.on('user-added', handleUserAdded);
    client.on('user-removed', handleUserRemoved);
    client.on('user-updated', handleUserUpdated);
    client.on('peer-video-state-change', handlePeerVideoStateChange);
    client.on('active-share-change', handleActiveShareChange);
    client.on('annotation-viewer-draw-request', handleAnnotationViewerDrawRequest);
    client.on('recording-change', handleRecordingChange);
    client.on('whiteboard-status-change', handleWhiteboardStatusChange);
    client.on('peer-whiteboard-state-change', handlePeerWhiteboardStateChange);
    client.on('chat-on-message', handleChatMessage);
    client.on('device-change', handleDeviceChange);

    async function connect() {
      try {
        // patchJsMedia: Zoom's own recommended default (off by default) —
        // automatically applies the latest media dependency fixes.
        const initResult = await client.init('en-US', 'Global', { patchJsMedia: true });
        if (isZoomExecutedFailure(initResult)) {
          throw initResult;
        }
        const joinResult = await client.join(sessionName, token, displayName);
        if (isZoomExecutedFailure(joinResult)) {
          throw joinResult;
        }
        if (cancelled) {
          return;
        }
        const self = client.getCurrentUserInfo();
        selfUserIdRef.current = self.userId;
        setIsSelfHost(self.isHost);
        setStatus('connected');
        setRecordingStatus(client.getRecordingClient().getCloudRecordingStatus());

        // The host (whoever actually started the session — see the page
        // server component's host-detection logic) starts recording
        // automatically. canStartRecording() covers the case where cloud
        // recording isn't enabled for this Zoom account/session; a resolved
        // Error from startCloudRecording() (it follows the `'' | Error`
        // pattern, not ExecutedFailure — doesn't reject) is also checked
        // explicitly and surfaced, rather than trusting the optimistic
        // 'recording-change' event alone.
        if (self.isHost) {
          const recordingClient = client.getRecordingClient();
          if (recordingClient.canStartRecording()) {
            const recordingResult = await recordingClient
              .startCloudRecording()
              .catch((error) => {
                return error instanceof Error ? error : new Error(String(error));
              });
            if (recordingResult instanceof Error) {
              // eslint-disable-next-line no-console
              console.error('Zoom cloud recording failed to start', recordingResult);
              setRecordingError(
                'Recording could not be started — check that cloud recording is enabled for this Zoom account.',
              );
              setRecordingStatus(RecordingStatus.Stopped);
            }
          } else {
            setRecordingError(
              'Cloud recording is not available for this session (check the Zoom account’s recording settings).',
            );
          }
        }

        const existingOther = client
          .getAllUser()
          .find((user) => user.userId !== self.userId);
        if (existingOther) {
          updateOtherParticipant({
            userId: existingOther.userId,
            displayName: existingOther.displayName,
            muted: existingOther.muted ?? false,
            bVideoOn: existingOther.bVideoOn,
            isHost: existingOther.isHost,
          });
          if (existingOther.bVideoOn && mainVideoRef.current) {
            void attachCameraTile(client, existingOther.userId, mainVideoRef.current);
          }
        }

        const whiteboardClient = client.getWhiteboardClient();
        setSupportsWhiteboard(whiteboardClient.isWhiteboardEnabled());

        // Late join: someone may already be presenting a whiteboard before we
        // connect — getWhiteboardPresenter() catches that, since the
        // 'peer-whiteboard-state-change' Start event only fires for joiners
        // who were already in the session when it started.
        const existingPresenter = whiteboardClient.getWhiteboardPresenter();
        if (existingPresenter && existingPresenter.userId !== self.userId) {
          setWhiteboardStatus(whiteboardClient.getWhiteboardStatus());
          if (whiteboardContainerRef.current) {
            await whiteboardClient
              .startWhiteboardView(
                whiteboardContainerRef.current,
                existingPresenter.userId,
              )
              .catch(() => null);
          }
        }

        const stream = client.getMediaStream();
        refreshDeviceLists();
        setSupportsVirtualBackground(stream.isSupportVirtualBackground());
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
      client.off('active-share-change', handleActiveShareChange);
      client.off('annotation-viewer-draw-request', handleAnnotationViewerDrawRequest);
      client.off('recording-change', handleRecordingChange);
      client.off('whiteboard-status-change', handleWhiteboardStatusChange);
      client.off('peer-whiteboard-state-change', handlePeerWhiteboardStateChange);
      client.off('chat-on-message', handleChatMessage);
      client.off('device-change', handleDeviceChange);
      void leaveWhiteboardCleanly(client, selfUserIdRef.current).then(() =>
        client.leave().catch(() => null),
      );
    };
  }, [
    sessionName,
    token,
    displayName,
    initialMuted,
    initialVideoOff,
    updateOtherParticipant,
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
      await stream.stopVideo().catch(() => null);
      if (container) {
        await detachCameraTile(client, selfId, container);
      }
      setIsVideoOn(false);
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

  const toggleScreenShare = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !localShareVideoRef.current) {
      return;
    }
    const stream = client.getMediaStream();
    setShareError(null);
    if (isSharingScreen) {
      await stream.stopShareScreen().catch(() => null);
      setIsSharingScreen(false);
    } else {
      try {
        await stream.startShareScreen(localShareVideoRef.current);
        setIsSharingScreen(true);
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
  }, [isSharingScreen]);

  const toggleAnnotation = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      return;
    }
    const stream = client.getMediaStream();
    if (isAnnotating) {
      await stream.stopAnnotation().catch(() => null);
      setIsAnnotating(false);
    } else {
      try {
        await stream.startAnnotation();
        stream.getAnnotationController().setToolType(annotationTool);
        setIsAnnotating(true);
      } catch {
        // Presenter hasn't enabled annotation, or the account doesn't
        // support it — stay off rather than showing a broken toolbar.
      }
    }
  }, [isAnnotating, annotationTool]);

  const selectAnnotationTool = useCallback((tool: AnnotationToolType) => {
    setAnnotationTool(tool);
    clientRef.current?.getMediaStream().getAnnotationController().setToolType(tool);
  }, []);

  const selectAnnotationColor = useCallback((color: number) => {
    clientRef.current?.getMediaStream().getAnnotationController().setToolColor(color);
  }, []);

  const toggleWhiteboard = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      return;
    }
    const whiteboardClient = client.getWhiteboardClient();
    if (isPresentingWhiteboard) {
      await whiteboardClient.stopWhiteboardScreen();
      setIsPresentingWhiteboard(false);
    } else if (whiteboardContainerRef.current) {
      // canStartWhiteboard() is Zoom's single authoritative gate — it folds
      // in permissions, current sharing state, and whiteboard status, so it
      // catches cases (e.g. a non-host lacking whiteboard permission) that
      // our own isSomeoneSharing/isWhiteboardActive checks can't see.
      if (!whiteboardClient.canStartWhiteboard()) {
        return;
      }
      try {
        await whiteboardClient.startWhiteboardScreen(whiteboardContainerRef.current);
        setIsPresentingWhiteboard(true);
      } catch {
        // Lost a race against another change in sharing/whiteboard state
        // between the canStartWhiteboard() check above and this call.
      }
    }
  }, [isPresentingWhiteboard]);

  const exportWhiteboardPdf = useCallback(() => {
    void clientRef.current
      ?.getWhiteboardClient()
      .exportWhiteboard('pdf', `whiteboard-${sessionName}`);
  }, [sessionName]);

  const sendChatMessage = useCallback(async () => {
    const client = clientRef.current;
    const text = chatDraft.trim();
    if (!client || !text) {
      return;
    }
    setChatDraft('');
    const result = await client.getChatClient().sendToAll(text);
    if (result instanceof Error) {
      return;
    }
    // Zoom doesn't echo your own sent message back through 'chat-on-message'.
    setChatMessages((previous) => [
      ...previous,
      {
        id: result.id ?? `self-${result.timestamp}`,
        senderUserId: selfUserIdRef.current ?? -1,
        senderName: displayName,
        message: text,
        timestamp: result.timestamp,
      },
    ]);
  }, [chatDraft, displayName]);

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

  const toggleMirror = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      return;
    }
    const next = !isMirrored;
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
  }, [isMirrored]);

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

  const toggleShareLock = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      return;
    }
    const next = !isShareLocked;
    const result = await client
      .getMediaStream()
      .lockShare(next)
      .catch(() => null);
    if (result === null || result instanceof Error) {
      return;
    }
    setIsShareLocked(next);
  }, [isShareLocked]);

  // Leaving the Zoom session itself must never be blocked on anything — see
  // the comments below — but navigating away (onLeave) now waits for the
  // feedback prompt to be dismissed (submit or skip), rather than firing
  // immediately, so there's a chance to rate the session on the way out.
  const handleLeave = useCallback(() => {
    const client = clientRef.current;
    if (client) {
      void leaveWhiteboardCleanly(client, selfUserIdRef.current).then(() =>
        client.leave().catch(() => null),
      );
    }
    setShowFeedbackPrompt(true);
  }, []);

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
    setShowFeedbackPrompt(false);
    setHasLeft(true);
    onLeave?.();
  }, [onLeave]);

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

  const participantCount = otherParticipant ? 2 : 1;

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
  const isWhiteboardActive = whiteboardStatus !== WhiteboardStatus.Closed;
  const effectiveViewMode: ViewMode =
    isSomeoneSharing || isWhiteboardActive ? 'speaker' : viewMode;
  const isAloneInSpeakerView =
    !otherParticipant &&
    !isSomeoneSharing &&
    !isWhiteboardActive &&
    effectiveViewMode === 'speaker';
  // Mirrors Zoom's own UI Toolkit: non-host participants must explicitly
  // acknowledge an in-progress recording (Stay) or leave — a passive banner
  // alone isn't disclosure/consent. The host already opted in by starting it.
  const shouldShowRecordingConsent =
    recordingStatus === RecordingStatus.Recording &&
    !isSelfHost &&
    !hasAcknowledgedRecording;

  // Rendered via a portal straight to document.body: a `fixed inset-0`
  // element only actually covers the real viewport if no ancestor sets a
  // transform/filter/etc. (any of which creates its own containing block
  // for fixed descendants) — this component is mounted deep inside page
  // layout wrappers we don't control, so the portal is what guarantees the
  // floating control bar and panels truly anchor to the screen, not to
  // whatever box happens to wrap this component on a given page.
  return createPortal(
    <TooltipProvider delayDuration={300}>
      <Dialog open={shouldShowRecordingConsent} onOpenChange={() => {}}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>This session is being recorded</DialogTitle>
            <DialogDescription>
              By staying in this session, you consent to being recorded. If you don&apos;t
              consent, you can leave now.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleLeave}>
              Leave
            </Button>
            <Button type="button" onClick={() => setHasAcknowledgedRecording(true)}>
              Stay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={showFeedbackPrompt}
        onOpenChange={(open) => {
          if (!open) {
            finishLeaving();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How was your session?</DialogTitle>
            <DialogDescription>
              Your feedback helps us improve future sessions.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center gap-2 py-2">
            {(
              [
                { rating: 1, label: 'Terrible', icon: Angry },
                { rating: 2, label: 'Poor', icon: Frown },
                { rating: 3, label: 'Okay', icon: Meh },
                { rating: 4, label: 'Good', icon: Smile },
                { rating: 5, label: 'Great', icon: Laugh },
              ] as const
            ).map(({ rating, label, icon: Icon }) => (
              <button
                key={rating}
                type="button"
                onClick={() => setFeedbackRating(rating)}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent',
                  feedbackRating === rating && 'bg-accent text-foreground',
                )}
              >
                <Icon
                  className={cn(
                    'h-7 w-7',
                    feedbackRating === rating ? 'text-primary' : undefined,
                  )}
                />
                {label}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={finishLeaving}>
              Skip
            </Button>
            <Button
              type="button"
              disabled={feedbackRating === null || isFeedbackSubmitting}
              onClick={() => void submitFeedback()}
            >
              {isFeedbackSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="fixed inset-0 z-40 flex flex-col bg-background">
        <div className="relative min-h-0 flex-1 overflow-hidden bg-muted">
          {status === 'connecting' ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting…
            </div>
          ) : null}

          {/* Header — timer/REC/participant count now live in the
                floating toolbar below instead of a separate overlay. */}
          <div className="absolute left-4 right-4 top-4 z-10 flex items-center justify-end gap-2">
            {!isSomeoneSharing ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() =>
                      setViewMode((mode) =>
                        mode === 'speaker' ? 'sideBySide' : 'speaker',
                      )
                    }
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-popover/90 text-popover-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-accent"
                  >
                    {viewMode === 'speaker' ? (
                      <Columns2 className="h-4 w-4" />
                    ) : (
                      <LayoutGrid className="h-4 w-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {viewMode === 'speaker'
                    ? 'Switch to side-by-side'
                    : 'Switch to speaker view'}
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>

          {showRecordingBanner ? (
            <OverlayBadge className="absolute inset-x-0 top-16 z-20 mx-auto w-fit">
              This session is being recorded
            </OverlayBadge>
          ) : null}

          {recordingError ? (
            <div className="absolute inset-x-4 top-16 z-20 mx-auto w-fit max-w-sm rounded-lg bg-destructive px-3 py-2 text-center text-xs font-medium text-destructive-foreground shadow-sm">
              {recordingError}
            </div>
          ) : null}

          {shareError ? (
            <div className="absolute inset-x-4 top-16 z-20 mx-auto w-fit max-w-sm rounded-lg bg-destructive px-3 py-2 text-center text-xs font-medium text-destructive-foreground shadow-sm">
              {shareError}
            </div>
          ) : null}

          {isAnnotating ? (
            <div className="absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-popover/95 p-2 shadow-sm backdrop-blur-sm">
              {(
                [
                  { tool: AnnotationToolType.Pen, icon: Pencil, label: 'Pen' },
                  {
                    tool: AnnotationToolType.Highlighter,
                    icon: Highlighter,
                    label: 'Highlighter',
                  },
                  { tool: AnnotationToolType.Arrow, icon: ArrowUpRight, label: 'Arrow' },
                  { tool: AnnotationToolType.Eraser, icon: Eraser, label: 'Eraser' },
                ] as const
              ).map(({ tool, icon: Icon, label }) => (
                <IconToolbarButton
                  key={label}
                  label={label}
                  active={annotationTool === tool}
                  onClick={() => selectAnnotationTool(tool)}
                >
                  <Icon className="h-4 w-4" />
                </IconToolbarButton>
              ))}
              <Separator orientation="vertical" className="mx-1 h-5" />
              {ANNOTATION_COLORS.map((color) => (
                <button
                  key={color.label}
                  type="button"
                  title={color.label}
                  onClick={() => selectAnnotationColor(color.value)}
                  className="h-5 w-5 cursor-pointer rounded-full ring-1 ring-border"
                  style={{ backgroundColor: annotationColorToHex(color.value) }}
                />
              ))}
              <Separator orientation="vertical" className="mx-1 h-5" />
              <IconToolbarButton
                label="Undo"
                onClick={() =>
                  clientRef.current?.getMediaStream().getAnnotationController().undo()
                }
              >
                <Undo2 className="h-4 w-4" />
              </IconToolbarButton>
              <IconToolbarButton
                label="Redo"
                onClick={() =>
                  clientRef.current?.getMediaStream().getAnnotationController().redo()
                }
              >
                <Redo2 className="h-4 w-4" />
              </IconToolbarButton>
              <IconToolbarButton
                label="Clear my annotations"
                onClick={() =>
                  clientRef.current
                    ?.getMediaStream()
                    .getAnnotationController()
                    .clear(AnnotationClearType.Mine)
                }
              >
                <Trash2 className="h-4 w-4" />
              </IconToolbarButton>
              <IconToolbarButton
                label="Close annotation"
                onClick={() => void toggleAnnotation()}
              >
                <X className="h-4 w-4" />
              </IconToolbarButton>
            </div>
          ) : null}

          <canvas
            ref={shareCanvasRef}
            className={cn(
              'h-full w-full rounded-xl',
              isSomeoneSharing && !isLocalShare ? 'block' : 'hidden',
            )}
          />

          {/* Local share preview: absolutely positioned and never
                display:none, so it always has real on-screen dimensions —
                startShareScreen() needs a non-zero render target the moment
                sharing starts, before isLocalShare can even become true
                (that only flips once the active-share-change event arrives,
                after the share has already begun). It fills the same main
                slot the canvas above uses for a remote share. */}
          <video
            ref={localShareVideoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              'absolute inset-0 z-10 h-full w-full rounded-xl bg-black object-contain',
              isLocalShare ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          />

          <div
            ref={whiteboardContainerRef}
            className={cn(
              'h-full w-full overflow-hidden rounded-xl bg-background',
              isWhiteboardActive ? 'block' : 'hidden',
            )}
          />

          {!isSomeoneSharing &&
          !isWhiteboardActive &&
          effectiveViewMode === 'sideBySide' ? (
            <div className="grid h-full w-full grid-cols-1 gap-3 sm:grid-cols-2">
              <VideoTile
                label={displayName}
                isSelf
                isMuted={isMuted}
                isVideoOn={isVideoOn}
                videoContainerRef={selfVideoRef}
                className="h-full w-full"
              />
              {otherParticipant ? (
                <VideoTile
                  label={otherParticipant.displayName}
                  isSelf={false}
                  isMuted={otherParticipant.muted}
                  isVideoOn={otherParticipant.bVideoOn}
                  videoContainerRef={mainVideoRef}
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
                  Waiting for the other person to join…
                </div>
              )}
            </div>
          ) : null}

          {!isSomeoneSharing && !isWhiteboardActive && effectiveViewMode === 'speaker' ? (
            otherParticipant ? (
              <VideoTile
                label={otherParticipant.displayName}
                isSelf={false}
                isMuted={otherParticipant.muted}
                isVideoOn={otherParticipant.bVideoOn}
                videoContainerRef={mainVideoRef}
                className="h-full w-full"
              />
            ) : (
              // Alone so far — show your own camera as the main view
              // instead of a tiny corner PiP next to an empty "waiting"
              // message. The self-PiP block below is suppressed via
              // isAloneInSpeakerView so selfVideoRef only attaches here.
              <VideoTile
                label={displayName}
                isSelf
                isMuted={isMuted}
                isVideoOn={isVideoOn}
                videoContainerRef={selfVideoRef}
                className="h-full w-full"
              />
            )
          ) : null}

          {/* Persistent alert while sharing — unlike the recording banner
                this never auto-dismisses, since "you're sharing" stays
                relevant for the whole duration, not just a few seconds. */}
          {isLocalShare ? (
            <div className="absolute inset-x-0 top-16 z-20 mx-auto flex w-fit items-center gap-2 rounded-full bg-popover/95 py-1.5 pl-3 pr-1.5 text-xs font-medium text-popover-foreground shadow-lg backdrop-blur-sm">
              <MonitorUp className="h-3.5 w-3.5" />
              You&apos;re sharing your screen
              <Button
                type="button"
                size="xs"
                variant="destructive"
                onClick={() => void toggleScreenShare()}
              >
                Stop sharing
              </Button>
            </div>
          ) : null}

          {isPresentingWhiteboard ? (
            <OverlayBadge className="absolute inset-x-0 top-16 z-10 mx-auto w-fit">
              You&apos;re presenting the whiteboard
            </OverlayBadge>
          ) : null}

          {isSomeoneSharing || isWhiteboardActive ? (
            // Both participants shrink to small tiles once the shared
            // screen or whiteboard takes over the main view — previously
            // only your own camera did, leaving the other person's feed
            // with nowhere to render while they were off in the
            // (unused, in this state) main slot.
            <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2 sm:flex-row">
              {otherParticipant ? (
                <VideoTile
                  label={otherParticipant.displayName}
                  isSelf={false}
                  isMuted={otherParticipant.muted}
                  isVideoOn={otherParticipant.bVideoOn}
                  videoContainerRef={mainVideoRef}
                  className="aspect-video w-28 sm:w-36"
                />
              ) : null}
              <VideoTile
                label={displayName}
                isSelf
                isMuted={isMuted}
                isVideoOn={isVideoOn}
                videoContainerRef={selfVideoRef}
                className="aspect-video w-28 sm:w-36"
              />
            </div>
          ) : effectiveViewMode === 'speaker' && !isAloneInSpeakerView ? (
            <VideoTile
              label={displayName}
              isSelf
              isMuted={isMuted}
              isVideoOn={isVideoOn}
              videoContainerRef={selfVideoRef}
              className="absolute bottom-4 right-4 z-10 aspect-video w-32 sm:w-48"
            />
          ) : null}
        </div>

        {/* Floating control bar: overlays the video. Auto-hiding after
              inactivity and manually minimizing both collapse to the same
              small handle below rather than disappearing entirely. */}
        {isControlsVisible ? (
          // bottom offset is set via inline style, not a Tailwind arbitrary
          // value — nesting max()/env() inside a bracketed class is fragile
          // across Tailwind/PostCSS versions and silently drops the whole
          // declaration if it fails to parse, which is what left this bar
          // with no bottom anchor at all (it rendered at the top instead).
          // Inline style hands the calc straight to the browser, no
          // intermediary parser involved.
          <div
            className="absolute inset-x-0 z-30 flex justify-center px-2"
            style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <div className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-border bg-popover/95 px-3 py-2 shadow-lg backdrop-blur-sm sm:gap-3 sm:px-4 sm:py-2.5">
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs font-medium tabular-nums text-popover-foreground">
                  {formatElapsed(elapsedSeconds)}
                </span>
                {recordingStatus === RecordingStatus.Recording ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                    <Circle className="h-2 w-2 animate-pulse fill-destructive text-destructive" />
                    REC
                  </span>
                ) : null}
                <span className="flex items-center gap-1 text-xs font-medium text-popover-foreground">
                  <UsersIcon className="h-3.5 w-3.5" />
                  {participantCount}
                </span>
              </div>
              <Separator orientation="vertical" className="h-5" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => void toggleMute()}
                  >
                    {isMuted ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isMuted ? 'Unmute' : 'Mute'}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => void toggleVideo()}
                  >
                    {isVideoOn ? (
                      <Video className="h-4 w-4" />
                    ) : (
                      <VideoOff className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isVideoOn ? 'Stop video' : 'Start video'}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={isSharingScreen ? 'default' : 'outline'}
                    size="icon"
                    disabled={isWhiteboardActive}
                    onClick={() => void toggleScreenShare()}
                  >
                    {isSharingScreen ? (
                      <MonitorX className="h-4 w-4" />
                    ) : (
                      <MonitorUp className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isWhiteboardActive
                    ? 'End the whiteboard to share your screen'
                    : 'Share screen'}
                </TooltipContent>
              </Tooltip>

              {isSomeoneSharing ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant={isAnnotating ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => void toggleAnnotation()}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Annotate</TooltipContent>
                </Tooltip>
              ) : null}
              {supportsWhiteboard && (!isSomeoneSharing || isPresentingWhiteboard) ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant={isPresentingWhiteboard ? 'default' : 'outline'}
                      size="icon"
                      disabled={
                        !isPresentingWhiteboard &&
                        (isSomeoneSharing || isWhiteboardActive)
                      }
                      onClick={() => void toggleWhiteboard()}
                    >
                      <PenTool className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isPresentingWhiteboard
                      ? 'Stop whiteboard'
                      : isWhiteboardActive
                        ? 'The other person is presenting the whiteboard'
                        : 'Start whiteboard'}
                  </TooltipContent>
                </Tooltip>
              ) : null}
              {isWhiteboardActive ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={exportWhiteboardPdf}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Export whiteboard as PDF</TooltipContent>
                </Tooltip>
              ) : null}
              <Popover
                open={activePanel === 'chat'}
                onOpenChange={(open) => setActivePanel(open ? 'chat' : null)}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant={activePanel === 'chat' ? 'default' : 'outline'}
                    size="icon"
                    className="relative"
                  >
                    <MessageSquare className="h-4 w-4" />
                    {unreadChatCount > 0 ? (
                      <Badge
                        variant="destructive"
                        className="absolute -right-1.5 -top-1.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]"
                      >
                        {unreadChatCount}
                      </Badge>
                    ) : null}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="center"
                  side="top"
                  sideOffset={12}
                  className="flex h-96 w-72 flex-col gap-0 p-0 sm:w-80"
                >
                  <PopoverHeader className="border-b border-border px-4 py-3">
                    <PopoverTitle>Chat</PopoverTitle>
                  </PopoverHeader>
                  <div
                    ref={chatScrollRef}
                    className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
                  >
                    {chatMessages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No messages yet.</p>
                    ) : (
                      chatMessages.map((item) => {
                        const isOwnMessage = item.senderUserId === selfUserIdRef.current;
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              'flex flex-col gap-1',
                              isOwnMessage && 'items-end',
                            )}
                          >
                            <div className="flex items-baseline gap-2 px-1">
                              <span className="text-xs font-medium text-muted-foreground">
                                {isOwnMessage ? 'You' : item.senderName}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatClockTime(item.timestamp)}
                              </span>
                            </div>
                            <p
                              className={cn(
                                'max-w-[85%] rounded-2xl px-3 py-1.5 text-sm break-words',
                                isOwnMessage
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-foreground',
                              )}
                            >
                              {item.message}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void sendChatMessage();
                    }}
                    className="flex items-center gap-2 border-t border-border p-3"
                  >
                    <Input
                      value={chatDraft}
                      onChange={(event) => setChatDraft(event.target.value)}
                      placeholder="Type a message"
                      className="flex-1"
                    />
                    <Button type="submit" size="icon" disabled={!chatDraft.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </PopoverContent>
              </Popover>

              <Popover
                open={activePanel === 'users'}
                onOpenChange={(open) => setActivePanel(open ? 'users' : null)}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant={activePanel === 'users' ? 'default' : 'outline'}
                    size="icon"
                  >
                    <UsersIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="center"
                  side="top"
                  sideOffset={12}
                  className="w-72 gap-0 p-0 sm:w-80"
                >
                  <PopoverHeader className="border-b border-border px-4 py-3">
                    <PopoverTitle>Participants</PopoverTitle>
                  </PopoverHeader>
                  <div className="max-h-80 space-y-1 overflow-y-auto px-2 py-3">
                    {[
                      {
                        userId: selfUserIdRef.current ?? -1,
                        name: displayName,
                        isYou: true,
                        isHost: isSelfHost,
                        muted: isMuted,
                        videoOn: isVideoOn,
                      },
                      ...(otherParticipant
                        ? [
                            {
                              userId: otherParticipant.userId,
                              name: otherParticipant.displayName,
                              isYou: false,
                              isHost: otherParticipant.isHost,
                              muted: otherParticipant.muted,
                              videoOn: otherParticipant.bVideoOn,
                            },
                          ]
                        : []),
                    ].map((participant) => (
                      <div
                        key={participant.userId}
                        className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-accent"
                      >
                        <Avatar size="sm">
                          <AvatarFallback>{getInitials(participant.name)}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate text-sm">
                          {participant.name}
                          {participant.isYou ? (
                            <span className="text-muted-foreground"> (You)</span>
                          ) : null}
                        </span>
                        {participant.isHost ? (
                          <Badge variant="secondary">Host</Badge>
                        ) : null}
                        {participant.muted ? (
                          <MicOff className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : null}
                        {!participant.videoOn ? (
                          <VideoOff className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant={isSettingsOpen ? 'default' : 'outline'}
                    size="icon"
                  >
                    <SettingsIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="center"
                  side="top"
                  sideOffset={12}
                  className="max-h-[70vh] w-80 overflow-y-auto"
                >
                  <PopoverHeader>
                    <PopoverTitle>Settings</PopoverTitle>
                  </PopoverHeader>
                  <Tabs defaultValue="audio">
                    <TabsList className="w-full">
                      <TabsTrigger value="audio">Audio</TabsTrigger>
                      <TabsTrigger value="video">Video</TabsTrigger>
                      <TabsTrigger value="advanced">Advanced</TabsTrigger>
                    </TabsList>
                    <TabsContent value="audio" className="space-y-4 pt-1">
                      <DeviceSelect
                        label="Microphone"
                        devices={micList}
                        selectedId={activeMicId}
                        onChange={selectMicrophone}
                      />
                      <DeviceSelect
                        label="Speaker"
                        devices={speakerList}
                        selectedId={activeSpeakerId}
                        onChange={selectSpeaker}
                      />
                      {supportsNoiseSuppression ? (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">
                            Audio processing
                          </p>
                          <RadioGroup
                            value={audioProcessing}
                            onValueChange={(value) =>
                              void selectAudioProcessing(value as AudioProcessingMode)
                            }
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="original" id="audio-original" />
                              <Label
                                htmlFor="audio-original"
                                className="text-sm font-normal"
                              >
                                Original sound
                              </Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem
                                value="noiseSuppression"
                                id="audio-noise-suppression"
                              />
                              <Label
                                htmlFor="audio-noise-suppression"
                                className="text-sm font-normal"
                              >
                                Background noise suppression
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>
                      ) : null}
                    </TabsContent>
                    <TabsContent value="video" className="space-y-4 pt-1">
                      <DeviceSelect
                        label="Camera"
                        devices={cameraList}
                        selectedId={activeCameraId}
                        onChange={selectCamera}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="mirror-video" className="text-sm font-normal">
                          Mirror my video
                        </Label>
                        <Switch
                          id="mirror-video"
                          checked={isMirrored}
                          onCheckedChange={toggleMirror}
                        />
                      </div>
                      {supportsVirtualBackground ? (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">
                            Background
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => void selectBackgroundPreset('none')}
                              className={cn(
                                'flex aspect-video cursor-pointer items-center justify-center gap-1.5 rounded-lg border text-xs text-muted-foreground',
                                backgroundPreset === 'none'
                                  ? 'border-primary ring-1 ring-primary'
                                  : 'border-border',
                              )}
                            >
                              <ImageOff className="h-3.5 w-3.5" />
                              None
                            </button>
                            <button
                              type="button"
                              onClick={() => void selectBackgroundPreset('blur')}
                              className={cn(
                                'flex aspect-video cursor-pointer items-center justify-center gap-1.5 rounded-lg border text-xs text-muted-foreground',
                                backgroundPreset === 'blur'
                                  ? 'border-primary ring-1 ring-primary'
                                  : 'border-border',
                              )}
                            >
                              <ImageIcon className="h-3.5 w-3.5" />
                              Blur
                            </button>
                            {BACKGROUND_PRESETS.map((preset) => (
                              <button
                                key={preset.value}
                                type="button"
                                onClick={() => void selectBackgroundPreset(preset.value)}
                                className={cn(
                                  'relative aspect-video cursor-pointer overflow-hidden rounded-lg border',
                                  backgroundPreset === preset.value
                                    ? 'border-primary ring-1 ring-primary'
                                    : 'border-border',
                                )}
                              >
                                <img
                                  src={preset.src}
                                  alt={preset.label}
                                  className="h-full w-full object-cover"
                                />
                                <span className="absolute inset-x-0 bottom-0 bg-popover/90 px-1.5 py-0.5 text-[10px] text-popover-foreground">
                                  {preset.label}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </TabsContent>
                    <TabsContent value="advanced" className="space-y-4 pt-1">
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          Hardware acceleration
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor="hw-accel-send" className="text-sm font-normal">
                            Sending
                          </Label>
                          <Switch
                            id="hw-accel-send"
                            checked={hwAccelEncode}
                            onCheckedChange={(checked) =>
                              toggleHardwareAcceleration('encode', checked)
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <Label
                            htmlFor="hw-accel-receive"
                            className="text-sm font-normal"
                          >
                            Receiving
                          </Label>
                          <Switch
                            id="hw-accel-receive"
                            checked={hwAccelDecode}
                            onCheckedChange={(checked) =>
                              toggleHardwareAcceleration('decode', checked)
                            }
                          />
                        </div>
                      </div>
                      {isSelfHost ? (
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor="share-lock" className="text-sm font-normal">
                            Only I can share my screen
                          </Label>
                          <Switch
                            id="share-lock"
                            checked={isShareLocked}
                            onCheckedChange={() => void toggleShareLock()}
                          />
                        </div>
                      ) : null}
                    </TabsContent>
                  </Tabs>
                </PopoverContent>
              </Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={handleLeave}
                  >
                    <PhoneOff className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Leave</TooltipContent>
              </Tooltip>
            </div>
          </div>
        ) : null}
      </div>
    </TooltipProvider>,
    document.body,
  );
}
