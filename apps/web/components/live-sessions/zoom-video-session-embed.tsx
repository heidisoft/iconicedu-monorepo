'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ZoomVideo, {
  AnnotationClearType,
  AnnotationToolType,
  ConnectionState,
  PassiveStopShareReason,
  RecordingStatus,
  SharePrivilege,
  VideoQuality,
  WhiteboardStatus,
} from '@zoom/videosdk';
import {
  Angry,
  ArrowUpRight,
  Captions,
  Circle,
  Columns2,
  Download,
  Eraser,
  Frown,
  Hand,
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
  OctagonX,
  PenTool,
  Pencil,
  PictureInPicture2,
  PhoneOff,
  Redo2,
  Send,
  Settings as SettingsIcon,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Smile,
  SmilePlus,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@iconicedu/ui-web/ui/alert-dialog';
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
import {
  logLiveSessionAuditEvent,
  reportLiveSessionQualityEvent,
  submitLiveSessionFeedback,
} from '@iconicedu/web/lib/live-sessions/public-api';

// The Document Picture-in-Picture API (Chromium-based browsers only, as of
// writing) has no TypeScript lib types yet — unlike window.open(), the PiP
// window shares the opener's JS realm/custom-element registry, which is
// exactly what lets a live Zoom <video-player> element keep rendering after
// being moved into it.
interface DocumentPictureInPictureApi {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPictureApi;
  }
}

const PIP_SUPPORTED =
  typeof window !== 'undefined' && 'documentPictureInPicture' in window;

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
// Collapses the SDK's 0-5 uplink/downlink levels into three buckets for both
// the signal icon and the quality-events sent to the backend.
type NetworkLevel = 'bad' | 'normal' | 'good';
type FloatingReaction = {
  id: string;
  emoji: string;
  // Randomized per-reaction so a burst of clicks drifts/tumbles outward
  // instead of every emoji stacking in an identical straight line up the
  // middle of the screen.
  dx: number;
  rotate: number;
  durationMs: number;
};
type CommandChannelPayload =
  | { type: 'raise-hand'; raised: boolean }
  | { type: 'reaction'; emoji: string };

const MIRROR_VIDEO_STORAGE_KEY = 'iconicedu:zoom-session:mirror-video';
const REACTION_EMOJIS = ['👍', '👏', '🎉', '❤️', '😂'];

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
    // The <video-player> element attachVideo() returns must be a descendant
    // of a <video-player-container> (Zoom's own custom element) — without
    // one, the player doesn't get the SDK's internal sizing logic applied
    // and can render smaller than its actual container, leaving a visible
    // gap. A plain <div> container (what this used to append straight into)
    // doesn't satisfy that. Custom elements also default to `display:
    // inline` with no intrinsic size, so it needs explicit sizing itself.
    let playerContainer = container.querySelector('video-player-container');
    if (!playerContainer) {
      playerContainer = document.createElement('video-player-container');
      playerContainer.className = 'block h-full w-full';
      container.replaceChildren(playerContainer);
    }
    playerContainer.replaceChildren(element);
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

// Zoom owns process-wide media workers behind createClient(). Always destroy
// them after leave so a later session can initialize cleanly after route
// navigation or an SDK upgrade. The WeakSet prevents the UI action and React
// cleanup from racing the same client through teardown twice.
const disposedZoomClients = new WeakSet<ZoomClient>();

async function disposeZoomClient(
  client: ZoomClient,
  selfUserId: number | null,
  endSession = false,
) {
  if (disposedZoomClients.has(client)) {
    return;
  }
  disposedZoomClients.add(client);
  await leaveWhiteboardCleanly(client, selfUserId);
  await client.leave(endSession).catch(() => null);
  await ZoomVideo.destroyClient().catch(() => null);
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

// Per the SDK docs: 0,1 = bad; 2 = normal; 3,4,5 = good. The worse of
// uplink/downlink decides the collapsed level shown to the user.
function collapseNetworkLevel(level: number): NetworkLevel {
  if (level <= 1) {
    return 'bad';
  }
  if (level === 2) {
    return 'normal';
  }
  return 'good';
}

function worseNetworkLevel(a: NetworkLevel, b: NetworkLevel): NetworkLevel {
  const rank: Record<NetworkLevel, number> = { bad: 0, normal: 1, good: 2 };
  return rank[a] <= rank[b] ? a : b;
}

function getNetworkLevel(
  byUserId: Record<number, { uplink: NetworkLevel; downlink: NetworkLevel }>,
  userId: number | null,
): NetworkLevel | undefined {
  if (userId === null) {
    return undefined;
  }
  const entry = byUserId[userId];
  return entry ? worseNetworkLevel(entry.uplink, entry.downlink) : undefined;
}

function createFloatingReaction(emoji: string): FloatingReaction {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    emoji,
    dx: Math.round((Math.random() - 0.5) * 160),
    rotate: Math.round((Math.random() - 0.5) * 50),
    durationMs: 2600 + Math.round(Math.random() * 900),
  };
}

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
        'flex max-w-full items-center gap-1.5 rounded-full bg-popover/90 px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-sm backdrop-blur-sm',
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

function NetworkLevelIcon({ level }: { level: NetworkLevel }) {
  if (level === 'bad') {
    return <SignalLow className="h-3 w-3 text-destructive" />;
  }
  if (level === 'normal') {
    return <SignalMedium className="h-3 w-3 text-warning" />;
  }
  return <SignalHigh className="h-3 w-3 text-success" />;
}

// Re-keying on toggleKey forces React to remount this span whenever a toggle
// button's state flips, which re-triggers the icon-pop CSS animation (see
// the embed's <style> block) — a quick, consistent "that registered" pop
// every time a control is switched back and forth, not just on first click.
function PoppingIcon({
  toggleKey,
  children,
}: {
  toggleKey: string | boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      key={String(toggleKey)}
      className="inline-flex animate-[icon-pop_260ms_cubic-bezier(0.34,1.56,0.64,1)]"
    >
      {children}
    </span>
  );
}

function VideoTile({
  label,
  isSelf,
  isMuted,
  isVideoOn,
  videoContainerRef,
  className,
  networkLevel,
  handRaised,
  cornerSide = 'right',
}: {
  label: string;
  isSelf: boolean;
  isMuted: boolean;
  isVideoOn: boolean;
  videoContainerRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
  networkLevel?: NetworkLevel;
  handRaised?: boolean;
  // Which bottom corner the status badge sits in — pass whichever side keeps
  // it away from the screen's own edge for that tile's position.
  cornerSide?: 'left' | 'right';
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/80 bg-muted shadow-lg ring-1 ring-foreground/10',
        className,
      )}
    >
      <div
        ref={videoContainerRef}
        // Mirroring (self-view only) is applied via the SDK's own
        // mirrorVideo() — see toggleMirror() — rather than a CSS transform,
        // so it's consistent with Zoom's "Mirror my video" setting and only
        // affects local rendering, never the captured/transmitted track.
        // attachCameraTile sizes the <video-player-container>/<video-player>
        // it creates directly via className, but this selector keeps them
        // full-size even if Zoom ever re-creates either element internally.
        className="h-full w-full [&>video-player-container]:block [&>video-player-container]:h-full [&>video-player-container]:w-full [&_video-player]:h-full [&_video-player]:w-full"
      />
      {!isVideoOn ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          {/* Scales with the tile instead of a fixed size, so it still reads
                as a face on a full speaker tile and doesn't blow out a tiny
                mini-tile during a share — clamped between a sensible floor
                and ceiling either way. */}
          <Avatar
            size="lg"
            className="aspect-square shrink-0"
            style={{ height: 'clamp(2rem, 40%, 7rem)', width: 'auto' }}
          >
            <AvatarFallback className="text-base sm:text-2xl">
              {getInitials(label)}
            </AvatarFallback>
          </Avatar>
        </div>
      ) : null}
      <div
        className={cn(
          'absolute bottom-2 z-20 flex h-7 items-center gap-1.5 rounded-full bg-popover/95 px-2 text-popover-foreground shadow-md backdrop-blur-sm',
          cornerSide === 'left' ? 'left-2' : 'right-2',
        )}
        aria-label={`${label} status`}
      >
        {handRaised ? (
          <Hand className="h-4 w-4 text-warning" aria-label="Hand raised" />
        ) : null}
        {isMuted ? (
          <MicOff className="h-4 w-4 text-destructive" aria-label="Microphone off" />
        ) : (
          <Mic className="h-4 w-4" aria-label="Microphone on" />
        )}
        {isVideoOn ? (
          <Video className="h-4 w-4" aria-label="Camera on" />
        ) : (
          <VideoOff className="h-4 w-4 text-destructive" aria-label="Camera off" />
        )}
      </div>
      <OverlayBadge
        className={cn(
          'absolute bottom-2 z-20 max-w-[calc(100%-5rem)]',
          cornerSide === 'left' ? 'right-2' : 'left-2',
        )}
      >
        {networkLevel ? <NetworkLevelIcon level={networkLevel} /> : null}
        <span className="min-w-0 truncate">
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
  const activeShareUserIdRef = useRef<number | null>(null);
  const otherParticipantRef = useRef<RemoteParticipant | null>(null);
  const selfVideoRef = useRef<HTMLDivElement | null>(null);
  const mainVideoRef = useRef<HTMLDivElement | null>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const shareCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // startShareScreen accepts HTMLCanvasElement | HTMLVideoElement, but the
  // SDK logs "Use Video element instead of Canvas element when WebCodecs
  // enabled" (and the share otherwise fails to render) on browsers where
  // WebCodecs is available — a <video> element works on both.
  const localShareVideoRef = useRef<HTMLVideoElement | null>(null);
  const whiteboardContainerRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const activePanelRef = useRef<SidePanel>(null);
  const isLeavingRef = useRef(false);

  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>(
    'connecting',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  // Whether the active presenter currently allows viewers to annotate —
  // defaults true (Zoom's own default) and is kept in sync via
  // 'annotation-privilege-change' so the Annotate button only appears when
  // it would actually work, instead of always showing and failing silently.
  const [canAnnotate, setCanAnnotate] = useState(true);
  const [whiteboardError, setWhiteboardError] = useState<string | null>(null);
  const [isPipActive, setIsPipActive] = useState(false);
  const [activeShareUserId, setActiveShareUserId] = useState<number | null>(null);
  const [otherParticipant, setOtherParticipant] = useState<RemoteParticipant | null>(
    null,
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isOtherHandRaised, setIsOtherHandRaised] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  // Uplink and downlink arrive as separate events, tracked separately so a
  // later improvement on one direction isn't permanently masked by an older
  // bad reading on the other — the displayed/reported level is the worse of
  // whatever the two most-recently-reported values currently are.
  const [networkQualityByUserId, setNetworkQualityByUserId] = useState<
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
  const [viewMode, setViewMode] = useState<ViewMode>('sideBySide');
  const [whiteboardStatus, setWhiteboardStatus] = useState<WhiteboardStatus>(
    WhiteboardStatus.Closed,
  );
  const [isPresentingWhiteboard, setIsPresentingWhiteboard] = useState(false);
  const [supportsWhiteboard, setSupportsWhiteboard] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
    // Skip while the browser's Picture-in-Picture window owns this node
    // (see enterPip) — mainVideoRef.current is the now-empty div left behind
    // in the main document, not the live video, so re-attaching here would
    // just grow a second, redundant copy instead of restoring anything.
    if (otherParticipant?.bVideoOn && mainVideoRef.current && !isPipActive) {
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
    isPipActive,
  ]);

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
        playJoinChime();
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

    // Presenters always keep full rights to their own share regardless of
    // this setting — it only governs whether *viewers* can annotate, so skip
    // it entirely when the local user is the one currently presenting.
    const handleAnnotationPrivilegeChange = (payload: {
      isAnnotationEnabled: boolean;
    }) => {
      if (activeShareUserIdRef.current === selfUserIdRef.current) {
        return;
      }
      setCanAnnotate(payload.isAnnotationEnabled);
      if (!payload.isAnnotationEnabled) {
        setIsAnnotating(false);
        void client
          .getMediaStream()
          .stopAnnotation()
          .catch(() => null);
      }
    };

    // Fires when sharing stops for a reason other than our own
    // stopShareScreen() call — the browser's native "Stop sharing" bar, or
    // the share privilege changing out from under us. Without this,
    // isSharingScreen stays stuck true and the "Stop sharing" banner lingers
    // even though the share has actually already ended.
    const handlePassivelyStopShare = (reason: PassiveStopShareReason) => {
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

    const handleCommandChannelMessage = (payload: { senderId: number; text: string }) => {
      if (payload.senderId === selfUserIdRef.current) {
        return;
      }
      let parsed: CommandChannelPayload;
      try {
        parsed = JSON.parse(payload.text) as CommandChannelPayload;
      } catch {
        return;
      }
      if (parsed.type === 'raise-hand') {
        setIsOtherHandRaised(parsed.raised);
        return;
      }
      if (parsed.type === 'reaction') {
        const reaction = createFloatingReaction(parsed.emoji);
        setFloatingReactions((previous) => [...previous, reaction]);
        setTimeout(() => {
          setFloatingReactions((previous) =>
            previous.filter((item) => item.id !== reaction.id),
          );
        }, reaction.durationMs);
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
    client.on('active-share-change', handleActiveShareChange);
    client.on('annotation-viewer-draw-request', handleAnnotationViewerDrawRequest);
    client.on('annotation-privilege-change', handleAnnotationPrivilegeChange);
    client.on('passively-stop-share', handlePassivelyStopShare);
    client.on('share-privilege-change', handleSharePrivilegeChange);
    client.on('recording-change', handleRecordingChange);
    client.on('whiteboard-status-change', handleWhiteboardStatusChange);
    client.on('peer-whiteboard-state-change', handlePeerWhiteboardStateChange);
    client.on('chat-on-message', handleChatMessage);
    client.on('device-change', handleDeviceChange);
    client.on('network-quality-change', handleNetworkQualityChange);
    client.on('connection-change', handleConnectionChange);
    client.on('device-permission-change', handleDevicePermissionChange);
    client.on('active-media-failed', handleActiveMediaFailed);
    client.on('command-channel-message', handleCommandChannelMessage);
    client.on('caption-message', handleCaptionMessage);

    async function connect() {
      try {
        const compatibility = ZoomVideo.checkSystemRequirements();
        setSupportsScreenShare(compatibility.screen);
        if (!compatibility.audio || !compatibility.video) {
          throw new Error(
            'This browser does not support the audio and video features required for this class. Update your browser or use a current version of Chrome, Edge, Firefox, or Safari.',
          );
        }
        // patchJsMedia: Zoom's own recommended default (off by default) —
        // automatically applies the latest media dependency fixes.
        const initResult = await client.init('en-US', 'Global', {
          patchJsMedia: true,
          stayAwake: true,
          leaveOnPageUnload: true,
        });
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
        playJoinChime();
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
            } else {
              void logLiveSessionAuditEvent(
                liveSessionId,
                {
                  action: 'recording_started',
                  targetDisplayName: null,
                  occurredAt: new Date().toISOString(),
                },
                accessToken,
              );
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
      client.off('active-share-change', handleActiveShareChange);
      client.off('annotation-viewer-draw-request', handleAnnotationViewerDrawRequest);
      client.off('annotation-privilege-change', handleAnnotationPrivilegeChange);
      client.off('passively-stop-share', handlePassivelyStopShare);
      client.off('share-privilege-change', handleSharePrivilegeChange);
      client.off('recording-change', handleRecordingChange);
      client.off('whiteboard-status-change', handleWhiteboardStatusChange);
      client.off('peer-whiteboard-state-change', handlePeerWhiteboardStateChange);
      client.off('chat-on-message', handleChatMessage);
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
      void disposeZoomClient(client, selfUserIdRef.current);
    };
  }, [
    sessionName,
    token,
    displayName,
    initialMuted,
    initialVideoOff,
    updateOtherParticipant,
    liveSessionId,
    accessToken,
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
        await stream.startShareScreen(localShareVideoRef.current, {
          // Lets me keep viewing others' shares while my own is active —
          // only meaningful (and only offered) when the host has allowed
          // multiple simultaneous presenters via the Advanced share-privilege
          // setting; otherwise this is a no-op.
          simultaneousShareView: sharePrivilege === SharePrivilege.MultipleShare,
        });
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
  }, [isSharingScreen, sharePrivilege]);

  const toggleAnnotation = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      return;
    }
    const stream = client.getMediaStream();
    setShareError(null);
    if (isAnnotating) {
      await stream.stopAnnotation().catch(() => null);
      setIsAnnotating(false);
    } else {
      // canDoAnnotation() reflects whether the Video SDK app itself has the
      // Annotation feature enabled (Zoom Marketplace → your app → Features) —
      // the same kind of account-level gate that silently broke the
      // whiteboard before canStartWhiteboard() was checked there. Previously
      // a false/thrown result here was swallowed with zero feedback, so
      // clicking Annotate looked like it did nothing at all.
      if (!stream.canDoAnnotation()) {
        setShareError(
          "Annotation couldn't be started — it may not be enabled for this account, or the account owner needs to turn it on for this app in the Zoom Marketplace.",
        );
        return;
      }
      try {
        await stream.startAnnotation();
        stream.getAnnotationController().setToolType(annotationTool);
        setIsAnnotating(true);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Zoom annotation failed to start', error);
        setShareError(describeZoomFailure(error));
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
    setWhiteboardError(null);
    const whiteboardClient = client.getWhiteboardClient();
    if (isPresentingWhiteboard) {
      await whiteboardClient.stopWhiteboardScreen();
      setIsPresentingWhiteboard(false);
    } else if (whiteboardContainerRef.current) {
      // canStartWhiteboard() is Zoom's single authoritative gate — it folds
      // in permissions, current sharing state, and whiteboard status, so it
      // catches cases (e.g. a non-host lacking whiteboard permission) that
      // our own isSomeoneSharing/isWhiteboardActive checks can't see. It was
      // previously a silent no-op when this returned false — clicking the
      // button looked like it did nothing at all.
      if (!whiteboardClient.canStartWhiteboard()) {
        setWhiteboardError(
          activeShareUserId !== null
            ? 'End screen sharing before starting the whiteboard.'
            : "Whiteboard couldn't be started — you may not have permission, or it's unavailable for this account.",
        );
        return;
      }
      try {
        await whiteboardClient.startWhiteboardScreen(whiteboardContainerRef.current);
        setIsPresentingWhiteboard(true);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Zoom whiteboard failed to start', error);
        setWhiteboardError(describeZoomFailure(error));
      }
    }
  }, [isPresentingWhiteboard, activeShareUserId]);

  const exportWhiteboardPdf = useCallback(() => {
    void clientRef.current
      ?.getWhiteboardClient()
      .exportWhiteboard('pdf', `whiteboard-${sessionName}`);
  }, [sessionName]);

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
  const sendReaction = useCallback((emoji: string) => {
    const client = clientRef.current;
    if (!client) {
      return;
    }
    const reaction = createFloatingReaction(emoji);
    setFloatingReactions((previous) => [...previous, reaction]);
    setTimeout(() => {
      setFloatingReactions((previous) =>
        previous.filter((item) => item.id !== reaction.id),
      );
    }, reaction.durationMs);
    void client
      .getCommandClient()
      .send(JSON.stringify({ type: 'reaction', emoji } satisfies CommandChannelPayload));
  }, []);

  const toggleCaptions = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      return;
    }
    setCaptionsError(null);
    const transcriptionClient = client.getLiveTranscriptionClient();
    if (isCaptionsOn) {
      transcriptionClient.disableCaptions(true);
      setIsCaptionsOn(false);
      setCaptionText('');
      return;
    }
    try {
      await transcriptionClient.startLiveTranscription();
      transcriptionClient.disableCaptions(false);
      setIsCaptionsOn(true);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Zoom live captions failed to start', error);
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
    void disposeZoomClient(client, selfUserIdRef.current, true);
    setShowEndForAllConfirm(false);
    setShowFeedbackPrompt(true);
  }, [isSelfHost, liveSessionId, accessToken]);

  const exitPip = useCallback(() => {
    const pipWindow = pipWindowRef.current;
    if (pipWindow && !pipWindow.closed) {
      pipWindow.close();
    }
  }, []);

  // Moves (not clones) the other participant's live video node into a real
  // floating always-on-top window via the Document Picture-in-Picture API —
  // unlike window.open(), that window shares this page's JS realm and custom
  // element registry, so Zoom's <video-player> keeps rendering normally
  // after the move instead of going blank. Falls back to a no-op wherever
  // the API isn't supported (anything non-Chromium, as of writing).
  const enterPip = useCallback(async () => {
    const sourceContainer = mainVideoRef.current;
    if (!PIP_SUPPORTED || pipWindowRef.current || !sourceContainer?.firstChild) {
      return;
    }
    try {
      const pipWindow = await window.documentPictureInPicture!.requestWindow({
        width: 320,
        height: 180,
      });
      pipWindowRef.current = pipWindow;

      const style = pipWindow.document.createElement('style');
      style.textContent = `
        html, body { margin: 0; padding: 0; height: 100%; background: #000; overflow: hidden; }
        body > * { display: block; width: 100%; height: 100%; object-fit: cover; }
      `;
      pipWindow.document.head.append(style);

      while (sourceContainer.firstChild) {
        pipWindow.document.body.append(sourceContainer.firstChild);
      }
      setIsPipActive(true);

      // Fires whichever way the PiP window closes — the user closing it
      // directly, or us calling pipWindow.close() from exitPip/the
      // visibility-change handler — so this is the one place that needs to
      // move the content back home and reset state.
      pipWindow.addEventListener('pagehide', () => {
        while (pipWindow.document.body.firstChild) {
          sourceContainer.append(pipWindow.document.body.firstChild);
        }
        pipWindowRef.current = null;
        setIsPipActive(false);
      });
    } catch {
      // Declined (e.g. called outside a user-activation context) — the call
      // just stays in-tab, same as before this feature existed.
    }
  }, []);

  // Automatically floats the other participant's video when the viewer
  // switches tabs or minimizes the window, and restores it when they come
  // back — the manual button below still works independently of this.
  useEffect(() => {
    if (!PIP_SUPPORTED || status !== 'connected') {
      return;
    }
    const handleVisibilityChange = () => {
      if (document.hidden) {
        void enterPip();
      } else {
        exitPip();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [status, enterPip, exitPip]);

  useEffect(() => {
    return () => exitPip();
  }, [exitPip]);

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

  // Leaving the Zoom session itself must never be blocked on anything — see
  // the comments below — but navigating away (onLeave) now waits for the
  // feedback prompt to be dismissed (submit or skip), rather than firing
  // immediately, so there's a chance to rate the session on the way out.
  const handleLeave = useCallback(() => {
    const client = clientRef.current;
    isLeavingRef.current = true;
    if (client) {
      void disposeZoomClient(client, selfUserIdRef.current);
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
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-popover/90 text-popover-foreground shadow-sm backdrop-blur-sm transition-all hover:bg-accent active:scale-90"
                  >
                    <PoppingIcon toggleKey={viewMode}>
                      {viewMode === 'speaker' ? (
                        <Columns2 className="h-4 w-4" />
                      ) : (
                        <LayoutGrid className="h-4 w-4" />
                      )}
                    </PoppingIcon>
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

          {whiteboardError ? (
            <div className="absolute inset-x-4 top-16 z-20 mx-auto w-fit max-w-sm rounded-lg bg-destructive px-3 py-2 text-center text-xs font-medium text-destructive-foreground shadow-sm">
              {whiteboardError}
            </div>
          ) : null}

          {mediaError ? (
            <div
              className="absolute inset-x-4 top-16 z-30 mx-auto flex w-fit max-w-lg items-center gap-3 rounded-xl border border-destructive/40 bg-popover/95 px-4 py-3 text-sm text-popover-foreground shadow-lg backdrop-blur-sm"
              role="alert"
            >
              <span>{mediaError}</span>
              <Button type="button" size="sm" onClick={() => window.location.reload()}>
                Refresh
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Dismiss media warning"
                onClick={() => setMediaError(null)}
              >
                <X className="h-4 w-4" />
              </Button>
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
            <div className="grid h-full w-full grid-cols-1 grid-rows-2 gap-3 sm:grid-cols-2 sm:grid-rows-1">
              <VideoTile
                label={displayName}
                isSelf
                isMuted={isMuted}
                isVideoOn={isVideoOn}
                videoContainerRef={selfVideoRef}
                className="h-full w-full"
                networkLevel={getNetworkLevel(
                  networkQualityByUserId,
                  selfUserIdRef.current,
                )}
                handRaised={isHandRaised}
                cornerSide="right"
              />
              {otherParticipant ? (
                <VideoTile
                  label={otherParticipant.displayName}
                  isSelf={false}
                  isMuted={otherParticipant.muted}
                  isVideoOn={otherParticipant.bVideoOn}
                  videoContainerRef={mainVideoRef}
                  className="h-full w-full"
                  networkLevel={getNetworkLevel(
                    networkQualityByUserId,
                    otherParticipant.userId,
                  )}
                  handRaised={isOtherHandRaised}
                  cornerSide="left"
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
                networkLevel={getNetworkLevel(
                  networkQualityByUserId,
                  otherParticipant.userId,
                )}
                handRaised={isOtherHandRaised}
                cornerSide="right"
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
                networkLevel={getNetworkLevel(
                  networkQualityByUserId,
                  selfUserIdRef.current,
                )}
                handRaised={isHandRaised}
                cornerSide="right"
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
                  networkLevel={getNetworkLevel(
                    networkQualityByUserId,
                    otherParticipant.userId,
                  )}
                  handRaised={isOtherHandRaised}
                  cornerSide="left"
                />
              ) : null}
              <VideoTile
                label={displayName}
                isSelf
                isMuted={isMuted}
                isVideoOn={isVideoOn}
                videoContainerRef={selfVideoRef}
                className="aspect-video w-28 sm:w-36"
                networkLevel={getNetworkLevel(
                  networkQualityByUserId,
                  selfUserIdRef.current,
                )}
                handRaised={isHandRaised}
                cornerSide="left"
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
              networkLevel={getNetworkLevel(
                networkQualityByUserId,
                selfUserIdRef.current,
              )}
              handRaised={isHandRaised}
              cornerSide="left"
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
                    className="h-11 w-11 sm:w-auto sm:px-3"
                    aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                    aria-pressed={!isMuted}
                    onClick={() => void toggleMute()}
                  >
                    <PoppingIcon toggleKey={isMuted}>
                      {isMuted ? (
                        <MicOff className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </PoppingIcon>
                    <span className="hidden sm:inline">
                      {isMuted ? 'Unmute' : 'Mute'}
                    </span>
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
                    className="h-11 w-11 sm:w-auto sm:px-3"
                    aria-label={isVideoOn ? 'Stop camera' : 'Start camera'}
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
                    <span className="hidden sm:inline">
                      {isVideoOn ? 'Stop video' : 'Start video'}
                    </span>
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
                    className="h-11 w-11 sm:w-auto sm:px-3"
                    aria-label={isSharingScreen ? 'Stop sharing screen' : 'Share screen'}
                    aria-pressed={isSharingScreen}
                    disabled={isWhiteboardActive || !supportsScreenShare}
                    onClick={() => void toggleScreenShare()}
                  >
                    <PoppingIcon toggleKey={isSharingScreen}>
                      {isSharingScreen ? (
                        <MonitorX className="h-4 w-4" />
                      ) : (
                        <MonitorUp className="h-4 w-4" />
                      )}
                    </PoppingIcon>
                    <span className="hidden sm:inline">
                      {isSharingScreen ? 'Stop share' : 'Share'}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {!supportsScreenShare
                    ? 'Screen sharing is not supported by this browser'
                    : isWhiteboardActive
                      ? 'End the whiteboard to share your screen'
                      : 'Share screen'}
                </TooltipContent>
              </Tooltip>

              {isSomeoneSharing && (isLocalShare || canAnnotate) ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant={isAnnotating ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => void toggleAnnotation()}
                    >
                      <PoppingIcon toggleKey={isAnnotating}>
                        <Pencil className="h-4 w-4" />
                      </PoppingIcon>
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
                      <PoppingIcon toggleKey={isPresentingWhiteboard}>
                        <PenTool className="h-4 w-4" />
                      </PoppingIcon>
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
              {PIP_SUPPORTED && otherParticipant ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant={isPipActive ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => (isPipActive ? exitPip() : void enterPip())}
                    >
                      <PoppingIcon toggleKey={isPipActive}>
                        <PictureInPicture2 className="h-4 w-4" />
                      </PoppingIcon>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isPipActive ? 'Exit picture-in-picture' : 'Picture-in-picture'}
                  </TooltipContent>
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
                        handRaised: isHandRaised,
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
                              handRaised: isOtherHandRaised,
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
                        {participant.handRaised ? (
                          <Hand className="h-3.5 w-3.5 text-warning" />
                        ) : null}
                        {participant.isHost ? (
                          <Badge variant="secondary">Host</Badge>
                        ) : null}
                        {participant.muted ? (
                          <MicOff className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : null}
                        {!participant.videoOn ? (
                          <VideoOff className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : null}
                        {isSelfHost && !participant.isYou && !participant.muted ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() =>
                                  muteParticipant(participant.userId, participant.name)
                                }
                              >
                                <MicOff className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Mute {participant.name}</TooltipContent>
                          </Tooltip>
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
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">
                            Share screen settings
                          </p>
                          <RadioGroup
                            value={String(sharePrivilege)}
                            onValueChange={(value) =>
                              void selectSharePrivilege(Number(value) as SharePrivilege)
                            }
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem
                                value={String(SharePrivilege.Locked)}
                                id="share-privilege-locked"
                              />
                              <Label
                                htmlFor="share-privilege-locked"
                                className="text-sm font-normal"
                              >
                                Only the host can share
                              </Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem
                                value={String(SharePrivilege.MultipleShare)}
                                id="share-privilege-multiple"
                              />
                              <Label
                                htmlFor="share-privilege-multiple"
                                className="text-sm font-normal"
                              >
                                Multiple participants can share simultaneously
                              </Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem
                                value={String(SharePrivilege.Unlocked)}
                                id="share-privilege-one-at-a-time"
                              />
                              <Label
                                htmlFor="share-privilege-one-at-a-time"
                                className="text-sm font-normal"
                              >
                                One participant can share at a time
                              </Label>
                            </div>
                          </RadioGroup>
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
                    variant={isHandRaised ? 'default' : 'outline'}
                    size="icon"
                    className="h-11 w-11 sm:w-auto sm:px-3"
                    aria-label={isHandRaised ? 'Lower hand' : 'Raise hand'}
                    aria-pressed={isHandRaised}
                    onClick={toggleHandRaise}
                  >
                    <PoppingIcon toggleKey={isHandRaised}>
                      <Hand className="h-4 w-4" />
                    </PoppingIcon>
                    <span className="hidden sm:inline">
                      {isHandRaised ? 'Lower hand' : 'Raise hand'}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isHandRaised ? 'Lower hand' : 'Raise hand'}
                </TooltipContent>
              </Tooltip>

              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="icon">
                    <SmilePlus className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="center"
                  side="top"
                  sideOffset={12}
                  className="flex w-fit gap-1 p-2"
                >
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-xl hover:bg-accent"
                      onClick={() => sendReaction(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={isCaptionsOn ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => void toggleCaptions()}
                  >
                    <PoppingIcon toggleKey={isCaptionsOn}>
                      <Captions className="h-4 w-4" />
                    </PoppingIcon>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isCaptionsOn ? 'Turn off captions' : 'Turn on captions (beta)'}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="h-11 w-11 sm:w-auto sm:px-3"
                    aria-label={
                      isSelfHost && !otherParticipant
                        ? 'End class'
                        : isSelfHost
                          ? 'Leave or end class'
                          : 'Leave class'
                    }
                    onClick={() => setShowEndForAllConfirm(true)}
                  >
                    <PoppingIcon toggleKey={isSelfHost && !otherParticipant}>
                      {isSelfHost && !otherParticipant ? (
                        <OctagonX className="h-4 w-4" />
                      ) : (
                        <PhoneOff className="h-4 w-4" />
                      )}
                    </PoppingIcon>
                    <span className="hidden sm:inline">
                      {isSelfHost && !otherParticipant ? 'End class' : 'Leave'}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isSelfHost && !otherParticipant
                    ? 'End class'
                    : isSelfHost
                      ? 'Leave or end class'
                      : 'Leave'}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        ) : null}

        {captionsError ? (
          <div className="absolute inset-x-4 bottom-24 z-20 mx-auto w-fit max-w-sm rounded-lg bg-destructive px-3 py-2 text-center text-xs font-medium text-destructive-foreground shadow-sm">
            {captionsError}
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

        {/* Pops up from the middle of the stage, drifts/tumbles outward by
              a random amount (see createFloatingReaction), then floats up
              and fades — a bit of per-reaction randomness reads as more
              alive than every click producing an identical straight-up
              float in the same spot. */}
        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
          {floatingReactions.map((reaction) => (
            <span
              key={reaction.id}
              className="absolute left-1/2 top-1/2 text-5xl will-change-transform"
              style={
                {
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

        <style>{`
          @keyframes float-reaction {
            /* Two segments, not three — each keyframe's own
                animation-timing-function governs the segment it starts,
                so this is a quick springy pop-in followed by one
                continuous, uninterrupted ease-out float+fade, instead of
                three separate easing curves chained back to back (which
                read as a stutter at every keyframe boundary). */
            0% {
              transform: translate(-50%, -50%) translate(0, 0) rotate(0deg) scale(0.3);
              opacity: 0;
              animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            12% {
              transform: translate(-50%, -50%) translate(calc(var(--dx) * 0.08), -6px)
                rotate(calc(var(--rot) * 0.08)) scale(1.1);
              opacity: 1;
              animation-timing-function: ease-out;
            }
            100% {
              transform: translate(-50%, -50%) translate(var(--dx), -340px) rotate(var(--rot))
                scale(0.95);
              opacity: 0;
            }
          }

          @keyframes icon-pop {
            0% { transform: scale(0.55); }
            60% { transform: scale(1.18); }
            100% { transform: scale(1); }
          }
        `}</style>
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
          ) : !otherParticipant ? (
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
    </TooltipProvider>,
    document.body,
  );
}
