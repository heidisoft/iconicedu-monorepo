'use client';

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ArrowLeft,
  Loader2,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Pencil,
  Check,
  X,
  Settings,
} from 'lucide-react';

// flag-exempt: completes the existing pre-join audio/device verification.
import { AudioSelfCheck } from './audio-self-check';
import { usePreviewVideoEffects } from './use-preview-video-effects';
import type { MeetingMediaPreferences } from './meeting-media-preferences';
import { MIRROR_VIDEO_STORAGE_KEY } from './zoom-video/zoom-video-session.constants';
import { MeetingPipSettings } from './zoom-video/meeting-picture-in-picture-controls';
import {
  AUTOMATIC_PIP_STORAGE_KEY,
  type AutomaticPipMode,
} from './zoom-video/use-meeting-picture-in-picture';
const PreviewSettings = lazy(() =>
  import('./zoom-video/zoom-settings-panel').then((module) => ({
    default: module.ZoomSettingsPanel,
  })),
);
import { Button } from '@iconicedu/ui-web/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@iconicedu/ui-web/ui/alert';
import { cn, getInitials } from '@iconicedu/ui-web/lib/utils';

// Start with browser capture; use Zoom’s local preview only when background
// segmentation is needed. Release preview devices before the call captures them.
export function DevicePreviewStep({
  displayName,
  sessionTitle,
  onJoin,
  children,
  joinDisabled = false,
  busy = false,
  error,
  onBack,
}: {
  displayName: string;
  sessionTitle: string;
  children?: ReactNode;
  joinDisabled?: boolean;
  busy?: boolean;
  error?: string | null;
  onBack?: () => void;
  onJoin: (preferences: {
    muted: boolean;
    videoOff: boolean;
    displayName?: string;
    mediaSettings?: MeetingMediaPreferences;
    cameraId?: string;
    microphoneId?: string;
  }) => void;
}) {
  const [name, setName] = useState(displayName);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(displayName);
  const mounted = useRef(true);
  const devicePending = useRef(false);
  useEffect(() => {
    setName(displayName);
    setDraftName(displayName);
    setEditingName(false);
  }, [displayName]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  const effectSurfaceRef = useRef<HTMLDivElement>(null);
  const nativePreview = usePreviewVideoEffects(effectSurfaceRef);
  const [mediaSettings, setMediaSettings] = useState<MeetingMediaPreferences>(() => {
    let mirrored = true;
    try {
      mirrored = localStorage.getItem(MIRROR_VIDEO_STORAGE_KEY) !== 'false';
    } catch {
      /* Storage is optional. */
    }
    return {
      backgroundPreset: 'none',
      audioProcessing: 'noiseSuppression',
      mirrored,
      hardwareAcceleration: { encode: true, decode: true },
    };
  });
  const [mediaSettingsChanged, setMediaSettingsChanged] = useState(false);
  const [pipMode, setPipMode] = useState<AutomaticPipMode>(() => {
    try {
      const value = localStorage.getItem(AUTOMATIC_PIP_STORAGE_KEY);
      if (['always', 'tabs', 'sharing', 'never'].includes(value ?? ''))
        return value as AutomaticPipMode;
    } catch {
      /* Storage is optional. */
    }
    return 'tabs';
  });
  const updateMediaSettings = (patch: Partial<MeetingMediaPreferences>) => {
    if (devicePending.current || busy) return;
    setMediaSettings((previous) => ({ ...previous, ...patch }));
    setMediaSettingsChanged(true);
  };
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState<string>();
  const [microphoneId, setMicrophoneId] = useState<string>();
  const refreshDevices = useCallback(async () => {
    try {
      const available = await navigator.mediaDevices?.enumerateDevices?.();
      if (mounted.current && available)
        setDevices(available.filter((device) => !!device.deviceId));
    } catch {
      /* Device discovery must not prevent joining with devices off. */
    }
  }, []);
  useEffect(() => {
    void refreshDevices();
    const media = navigator.mediaDevices;
    media?.addEventListener?.('devicechange', refreshDevices);
    return () => media?.removeEventListener?.('devicechange', refreshDevices);
  }, [refreshDevices]);

  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    Promise.resolve()
      .then(() => {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error('Media preview unavailable');
        return navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setCameraId(stream.getVideoTracks?.()[0]?.getSettings?.().deviceId);
        setMicrophoneId(stream.getAudioTracks?.()[0]?.getSettings?.().deviceId);
        void refreshDevices();
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setIsLoading(false);
        setMuted(true);
        setVideoOff(true);
        setPermissionError(
          'Camera/microphone access was blocked. You can still join with them off and enable them later.',
        );
      });

    return () => {
      cancelled = true;
      mounted.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [refreshDevices]);

  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !videoOff;
    });
  }, [videoOff]);

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }, [muted]);

  const acquireDevice = async (kind: 'audio' | 'video', deviceId?: string) => {
    devicePending.current = true;
    setIsLoading(true);
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({
        [kind]: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      if (!mounted.current) {
        acquired.getTracks().forEach((track) => track.stop());
        return false;
      }
      const previous =
        kind === 'audio'
          ? streamRef.current?.getAudioTracks()
          : streamRef.current?.getVideoTracks();
      if (!streamRef.current) streamRef.current = acquired;
      else {
        acquired.getTracks().forEach((track) => streamRef.current!.addTrack(track));
        previous?.forEach((track) => {
          streamRef.current!.removeTrack(track);
          track.stop();
        });
      }
      if (videoRef.current) videoRef.current.srcObject = streamRef.current;
      const actualId = acquired.getTracks()[0]?.getSettings?.().deviceId ?? deviceId;
      if (kind === 'audio') setMicrophoneId(actualId);
      else setCameraId(actualId);
      setPermissionError(null);
      void refreshDevices();
      return true;
    } catch {
      if (mounted.current)
        setPermissionError(
          `Could not turn on your ${kind === 'audio' ? 'microphone' : 'camera'}. Check browser permissions and try again.`,
        );
      return false;
    } finally {
      devicePending.current = false;
      if (mounted.current) setIsLoading(false);
    }
  };
  const toggleDevice = async (kind: 'audio' | 'video') => {
    if (devicePending.current || busy) return;
    const off = kind === 'audio' ? muted : videoOff;
    if (
      kind === 'video' &&
      (nativePreview.active || mediaSettings.backgroundPreset !== 'none')
    ) {
      devicePending.current = true;
      setIsLoading(true);
      try {
        if (!off) await nativePreview.stop();
        else if (!(await nativePreview.start(cameraId, mediaSettings.backgroundPreset)))
          return;
        if (mounted.current) setVideoOff(!off);
      } catch {
        if (mounted.current)
          setPermissionError(
            'Could not start the camera with this background. Try another background or camera.',
          );
      } finally {
        devicePending.current = false;
        if (mounted.current) setIsLoading(false);
      }
      return;
    }
    const tracks =
      kind === 'audio'
        ? streamRef.current?.getAudioTracks()
        : streamRef.current?.getVideoTracks();
    if (off && !tracks?.some((track) => track.readyState !== 'ended')) {
      if (!(await acquireDevice(kind, kind === 'audio' ? microphoneId : cameraId)))
        return;
    } else
      tracks?.forEach((track) => {
        track.enabled = off;
      });
    if (kind === 'audio') setMuted(!off);
    else setVideoOff(!off);
  };
  const selectDevice = async (kind: 'audio' | 'video', id: string) => {
    if (devicePending.current || busy) return;
    const off = kind === 'audio' ? muted : videoOff;
    if (!off && kind === 'video' && nativePreview.active) {
      devicePending.current = true;
      setIsLoading(true);
      try {
        await nativePreview.camera(id);
        if (mounted.current) setCameraId(id);
      } catch {
        if (mounted.current)
          setPermissionError(
            'Could not switch cameras. Your previous camera is still selected.',
          );
      } finally {
        devicePending.current = false;
        if (mounted.current) setIsLoading(false);
      }
      return;
    }
    if (!off) {
      await acquireDevice(kind, id);
      return;
    }
    // Choosing a device while off must not activate it; discard the previous
    // disabled track so the next toggle acquires the newly selected device.
    const tracks =
      kind === 'audio'
        ? streamRef.current?.getAudioTracks()
        : streamRef.current?.getVideoTracks();
    tracks?.forEach((track) => {
      streamRef.current?.removeTrack(track);
      track.stop();
    });
    if (kind === 'audio') setMicrophoneId(id);
    else setCameraId(id);
  };
  const selectBackground = async (
    preset: MeetingMediaPreferences['backgroundPreset'],
  ) => {
    if (devicePending.current || busy) return;
    if (videoOff) {
      updateMediaSettings({ backgroundPreset: preset });
      return;
    }
    devicePending.current = true;
    setIsLoading(true);
    try {
      if (nativePreview.active) await nativePreview.background(preset);
      else if (preset !== 'none') {
        streamRef.current?.getVideoTracks().forEach((track) => {
          streamRef.current?.removeTrack(track);
          track.stop();
        });
        if (!(await nativePreview.start(cameraId, preset))) return;
      }
      if (mounted.current) {
        setMediaSettings((previous) => ({ ...previous, backgroundPreset: preset }));
        setMediaSettingsChanged(true);
        setPermissionError(null);
      }
    } catch (error) {
      if (mounted.current) {
        await nativePreview.stop();
        const restored = await acquireDevice('video', cameraId);
        setMediaSettings((previous) => ({ ...previous, backgroundPreset: 'none' }));
        setMediaSettingsChanged(true);
        if (!restored) setVideoOff(true);
        setPermissionError(
          (error instanceof Error && error.message.includes('not supported')) ||
            (typeof error === 'object' &&
              error !== null &&
              'reason' in error &&
              String(error.reason).includes('not supported'))
            ? 'Background blur is not supported in this browser. Your camera is available without blur.'
            : restored
              ? 'Background blur could not start. Your camera has been restored without blur. Please try again.'
              : 'Your camera could not restart. Check camera permissions and turn your camera on to try again.',
        );
      }
    } finally {
      devicePending.current = false;
      if (mounted.current) setIsLoading(false);
    }
  };
  const handleJoin = async () => {
    if (devicePending.current || busy) return;
    devicePending.current = true;
    setIsLoading(true);
    await nativePreview.stop();
    devicePending.current = false;
    if (mounted.current) setIsLoading(false);
    onJoin({
      muted,
      videoOff,
      ...(mediaSettingsChanged ? { mediaSettings } : {}),
      ...(cameraId ? { cameraId } : {}),
      ...(microphoneId ? { microphoneId } : {}),
      ...(name !== displayName ? { displayName: name } : {}),
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 px-6 py-10">
      <Button
        variant="ghost"
        className="self-start"
        disabled={busy}
        onClick={onBack ?? (() => window.history.back())}
      >
        <ArrowLeft className="size-4" />
        Back
      </Button>
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">{sessionTitle}</h1>
      </div>

      {children}
      <div
        role="group"
        aria-label="Your video preview"
        className="relative aspect-video w-full overflow-hidden rounded-3xl bg-secondary shadow-inner"
      >
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting camera…
          </div>
        ) : null}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={cn(
            'h-full w-full object-cover',
            mediaSettings.mirrored && '-scale-x-100',
            (videoOff || nativePreview.active) && 'hidden',
          )}
        />
        <div
          ref={effectSurfaceRef}
          className={cn(
            'absolute inset-0 h-full w-full object-cover',
            mediaSettings.mirrored && '-scale-x-100',
            (!nativePreview.active || videoOff) && 'pointer-events-none opacity-0',
          )}
        />
        {!isLoading && videoOff ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-background/90 text-lg font-medium text-foreground shadow-sm ring-4 ring-background/50">
              {getInitials(name)}
            </div>
          </div>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-start gap-1.5 px-4 pb-4 pt-4 text-white">
          {editingName ? (
            <form
              className="flex min-w-0 flex-1 items-center gap-1 rounded-full bg-black/45 px-2 py-1 focus-within:ring-2 focus-within:ring-white/70"
              onSubmit={(event) => {
                event.preventDefault();
                if (draftName.trim()) {
                  setName(draftName.trim());
                  setEditingName(false);
                }
              }}
            >
              <input
                autoFocus
                aria-label="Display name"
                maxLength={80}
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setEditingName(false);
                }}
                className="min-w-0 w-full bg-transparent px-1 text-sm text-white outline-none"
              />
              <button
                type="submit"
                aria-label="Save name"
                disabled={!draftName.trim()}
                className="rounded-full p-1.5 hover:bg-white/15 disabled:opacity-40"
              >
                <Check className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Cancel name change"
                onClick={() => setEditingName(false)}
                className="rounded-full p-1.5 hover:bg-white/15"
              >
                <X className="size-4" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              aria-label={`Change display name, currently ${name}`}
              disabled={busy}
              onClick={() => {
                setDraftName(name);
                setEditingName(true);
              }}
              className="flex min-w-0 items-center gap-2 h-8 rounded-full bg-black/45 px-3 text-xs shadow-sm backdrop-blur-lg transition-colors hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span className="truncate">{name}</span>
              <Pencil className="size-3 shrink-0" aria-hidden="true" />
            </button>
          )}
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'size-8 rounded-full bg-black/45 text-white shadow-sm backdrop-blur-lg hover:bg-black/60 hover:text-white',
                muted && 'text-destructive hover:text-destructive',
              )}
              aria-label={muted ? 'Turn microphone on' : 'Turn microphone off'}
              title={muted ? 'Turn microphone on' : 'Turn microphone off'}
              aria-pressed={!muted}
              onClick={() => void toggleDevice('audio')}
              disabled={isLoading || busy}
            >
              {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'size-8 rounded-full bg-black/45 text-white shadow-sm backdrop-blur-lg hover:bg-black/60 hover:text-white',
                videoOff && 'text-destructive hover:text-destructive',
              )}
              aria-label={videoOff ? 'Turn camera on' : 'Turn camera off'}
              title={videoOff ? 'Turn camera on' : 'Turn camera off'}
              aria-pressed={!videoOff}
              onClick={() => void toggleDevice('video')}
              disabled={isLoading || busy}
            >
              {videoOff ? <VideoOff className="size-4" /> : <Video className="size-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Settings"
              title="Settings"
              disabled={isLoading || busy}
              onClick={() => {
                setSettingsOpen(true);
                void refreshDevices();
              }}
              className="size-8 rounded-full bg-black/45 text-white shadow-sm backdrop-blur-lg hover:bg-black/60 hover:text-white"
            >
              <Settings className="size-4" />
            </Button>
          </div>
        </div>
      </div>
      {settingsOpen && (
        <Suspense
          fallback={
            <p role="status" className="text-sm text-muted-foreground">
              Loading settings…
            </p>
          }
        >
          <PreviewSettings
            audioCheck={
              <AudioSelfCheck
                stream={streamRef.current}
                muted={muted}
                speakerId={mediaSettings.speakerId}
              />
            }
            open={settingsOpen}
            hideTrigger
            onOpenChange={setSettingsOpen}
            disabled={isLoading || busy}
            cameras={devices.filter((device) => device.kind === 'videoinput')}
            microphones={devices.filter((device) => device.kind === 'audioinput')}
            speakers={devices.filter((device) => device.kind === 'audiooutput')}
            activeCameraId={
              cameraId ??
              devices.find((device) => device.kind === 'videoinput')?.deviceId ??
              null
            }
            activeMicrophoneId={
              microphoneId ??
              devices.find((device) => device.kind === 'audioinput')?.deviceId ??
              null
            }
            activeSpeakerId={
              mediaSettings.speakerId ??
              devices.find((device) => device.kind === 'audiooutput')?.deviceId ??
              null
            }
            audioProcessing={mediaSettings.audioProcessing}
            backgroundPreset={mediaSettings.backgroundPreset}
            isMirrored={mediaSettings.mirrored}
            hardwareAcceleration={mediaSettings.hardwareAcceleration}
            supportsNoiseSuppression
            supportsVirtualBackground
            isHost={false}
            sharePrivilege={0}
            onSelectCamera={(id) => void selectDevice('video', id)}
            onSelectMicrophone={(id) => void selectDevice('audio', id)}
            onSelectSpeaker={(id) => updateMediaSettings({ speakerId: id })}
            onSelectAudioProcessing={(mode) =>
              updateMediaSettings({ audioProcessing: mode })
            }
            onToggleMirror={(mirrored) => updateMediaSettings({ mirrored })}
            onSelectBackground={(preset) => void selectBackground(preset)}
            onToggleHardwareAcceleration={(kind, enabled) =>
              updateMediaSettings({
                hardwareAcceleration: {
                  ...mediaSettings.hardwareAcceleration,
                  [kind]: enabled,
                },
              })
            }
            onSelectSharePrivilege={() => undefined}
            pictureInPictureSettings={
              <MeetingPipSettings
                pip={{
                  mode: pipMode,
                  supported:
                    typeof window !== 'undefined' && !!window.documentPictureInPicture,
                  setAutomaticMode: (mode) => {
                    setPipMode(mode);
                    try {
                      localStorage.setItem(AUTOMATIC_PIP_STORAGE_KEY, mode);
                    } catch {
                      /* Storage is optional. */
                    }
                  },
                }}
              />
            }
            feedback={
              permissionError ? (
                <p role="alert" className="mt-3 text-xs text-muted-foreground">
                  {permissionError}
                </p>
              ) : undefined
            }
          />
        </Suspense>
      )}
      {permissionError && !settingsOpen && (
        <p role="status" className="text-center text-xs text-muted-foreground">
          {permissionError}
        </p>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Unable to join</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        type="button"
        className="w-full"
        onClick={handleJoin}
        disabled={joinDisabled || busy || editingName || isLoading}
      >
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        Join session
      </Button>
    </div>
  );
}
