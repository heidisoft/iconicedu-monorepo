'use client';

import type { ReactNode } from 'react';
import { SharePrivilege } from '@zoom/videosdk';
import { Check, Settings, UserRound, Mic, Video, SlidersHorizontal } from 'lucide-react';
import { Label } from '@iconicedu/ui-web/ui/label';
import { RadioGroup, RadioGroupItem } from '@iconicedu/ui-web/ui/radio-group';
import { DeviceSelect } from '../media-device-select';
import { Switch } from '@iconicedu/ui-web/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@iconicedu/ui-web/ui/tabs';
import { cn } from '@iconicedu/ui-web/lib/utils';
import type {
  AudioProcessingMode,
  BackgroundPreset,
  MediaDeviceOption,
} from './zoom-video-session.types';
import { BACKGROUND_PRESETS } from '../background-catalog';
import { MeetingControlButton } from './zoom-meeting-controls';
import { ZoomMeetingDialog } from './zoom-meeting-dialog';

type Props = {
  disabled?: boolean;
  feedback?: ReactNode;
  audioCheck?: ReactNode;
  open: boolean;
  hideTrigger?: boolean;
  pictureInPictureSettings?: ReactNode;
  cameras: MediaDeviceOption[];
  microphones: MediaDeviceOption[];
  speakers: MediaDeviceOption[];
  activeCameraId: string | null;
  activeMicrophoneId: string | null;
  activeSpeakerId: string | null;
  audioProcessing: AudioProcessingMode;
  backgroundPreset: BackgroundPreset;
  sharePrivilege: SharePrivilege;
  isMirrored: boolean;
  hardwareAcceleration: { encode: boolean; decode: boolean };
  supportsNoiseSuppression: boolean;
  supportsVirtualBackground: boolean;
  isHost: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCamera: (id: string) => void;
  onSelectMicrophone: (id: string) => void;
  onSelectSpeaker: (id: string) => void;
  onSelectAudioProcessing: (mode: AudioProcessingMode) => void;
  onToggleMirror: (enabled: boolean) => void;
  onSelectBackground: (preset: BackgroundPreset) => void;
  onToggleHardwareAcceleration: (kind: 'encode' | 'decode', enabled: boolean) => void;
  onSelectSharePrivilege: (privilege: SharePrivilege) => void;
};

function SettingToggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label htmlFor={id} className="text-sm font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function ZoomSettingsPanel(props: Props) {
  return (
    <ZoomMeetingDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="Settings"
      description="Manage video, audio and how your call appears."
      trigger={
        !props.hideTrigger ? (
          <MeetingControlButton label="Settings" tone={props.open ? 'active' : 'neutral'}>
            <Settings className="size-4" />
          </MeetingControlButton>
        ) : undefined
      }
    >
      <fieldset disabled={props.disabled} className="min-w-0">
        <Tabs defaultValue="audio">
          <TabsList className="w-full">
            <TabsTrigger value="audio" className="gap-1.5">
              <Mic aria-hidden="true" className="size-4" />
              Audio
            </TabsTrigger>
            <TabsTrigger value="video" className="gap-1.5">
              <Video aria-hidden="true" className="size-4" />
              Video
            </TabsTrigger>
            <TabsTrigger value="advanced" className="gap-1.5">
              <SlidersHorizontal aria-hidden="true" className="size-4" />
              Advanced
            </TabsTrigger>
          </TabsList>
          <TabsContent value="audio" className="space-y-4 pt-1">
            <DeviceSelect
              label="Microphone"
              devices={props.microphones}
              selectedId={props.activeMicrophoneId}
              onChange={props.onSelectMicrophone}
            />
            <DeviceSelect
              label="Speaker"
              devices={props.speakers}
              selectedId={props.activeSpeakerId}
              onChange={props.onSelectSpeaker}
            />
            {props.supportsNoiseSuppression ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Audio processing
                </p>
                <RadioGroup
                  value={props.audioProcessing}
                  onValueChange={(value) =>
                    props.onSelectAudioProcessing(value as AudioProcessingMode)
                  }
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="original" id="audio-original" />
                    <Label htmlFor="audio-original" className="text-sm font-normal">
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
            {props.audioCheck && (
              <div className="rounded-xl border p-3">{props.audioCheck}</div>
            )}
          </TabsContent>
          <TabsContent value="video" className="space-y-4 pt-1">
            <DeviceSelect
              label="Camera"
              devices={props.cameras}
              selectedId={props.activeCameraId}
              onChange={props.onSelectCamera}
            />
            <SettingToggle
              id="mirror-video"
              label="Mirror my video"
              checked={props.isMirrored}
              onChange={props.onToggleMirror}
            />
            {props.supportsVirtualBackground ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Background</p>
                <p className="text-xs text-muted-foreground">
                  Keep yourself clear and soften what&apos;s behind you.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['none', 'No effect', 'Your original background'],
                      ['blur', 'Blur background', 'Soften your background'],
                    ] as const
                  ).map(([value, label, description]) => {
                    const selected = props.backgroundPreset === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-label={label}
                        aria-pressed={selected}
                        onClick={() => props.onSelectBackground(value)}
                        className={cn(
                          'relative flex min-w-0 flex-col gap-2 rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60',
                          selected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border bg-background hover:bg-muted/50',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className="relative flex h-12 w-full items-end justify-center overflow-hidden rounded-lg bg-secondary"
                        >
                          <span
                            className={cn(
                              'absolute inset-0 flex items-center justify-between px-3',
                              value === 'blur' && 'blur-sm',
                            )}
                          >
                            <span className="h-8 w-6 rounded-sm border-2 border-foreground/20" />
                            <span className="h-5 w-7 rounded-sm bg-primary/20" />
                          </span>
                          <UserRound className="relative size-9 rounded-t-full bg-background text-foreground/80" />
                          {selected && (
                            <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                              <Check className="size-3" />
                            </span>
                          )}
                        </span>
                        <span className="text-xs font-medium text-foreground">
                          {label}
                        </span>
                        <span className="text-[11px] leading-tight text-muted-foreground">
                          {description}
                        </span>
                      </button>
                    );
                  })}
                </div>{' '}
                {BACKGROUND_PRESETS.length > 0 && (
                  <div
                    className="grid grid-cols-2 gap-2 p-1"
                    aria-label="Photo backgrounds"
                  >
                    {BACKGROUND_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        aria-label={preset.label}
                        aria-pressed={props.backgroundPreset === preset.value}
                        onClick={() => props.onSelectBackground(preset.value)}
                        className={cn(
                          'relative overflow-hidden rounded-xl border bg-background text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          props.backgroundPreset === preset.value
                            ? 'border-primary ring-2 ring-inset ring-primary'
                            : 'border-border hover:border-primary/50',
                        )}
                      >
                        <img
                          src={preset.src}
                          alt=""
                          loading="lazy"
                          className="aspect-video w-full object-cover"
                        />
                        <span className="block px-2 py-1.5 text-xs font-medium text-foreground">
                          {preset.label}
                        </span>
                        {props.backgroundPreset === preset.value && (
                          <span className="absolute right-1.5 top-1.5 rounded-full bg-primary p-1 text-primary-foreground">
                            <Check className="size-3" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </TabsContent>
          <TabsContent value="advanced" className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Hardware acceleration
              </p>
              <SettingToggle
                id="hw-accel-send"
                label="Sending"
                checked={props.hardwareAcceleration.encode}
                onChange={(checked) =>
                  props.onToggleHardwareAcceleration('encode', checked)
                }
              />
              <SettingToggle
                id="hw-accel-receive"
                label="Receiving"
                checked={props.hardwareAcceleration.decode}
                onChange={(checked) =>
                  props.onToggleHardwareAcceleration('decode', checked)
                }
              />
            </div>
            {props.isHost ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Share screen settings
                </p>
                <RadioGroup
                  value={String(props.sharePrivilege)}
                  onValueChange={(value) =>
                    props.onSelectSharePrivilege(Number(value) as SharePrivilege)
                  }
                >
                  {[
                    [SharePrivilege.Locked, 'Only the host can share'],
                    [
                      SharePrivilege.MultipleShare,
                      'Multiple participants can share simultaneously',
                    ],
                    [SharePrivilege.Unlocked, 'One participant can share at a time'],
                  ].map(([value, label]) => (
                    <div key={String(value)} className="flex items-center gap-2">
                      <RadioGroupItem
                        value={String(value)}
                        id={`share-privilege-${value}`}
                      />
                      <Label
                        htmlFor={`share-privilege-${value}`}
                        className="text-sm font-normal"
                      >
                        {label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            ) : null}
            {props.pictureInPictureSettings && (
              <section
                className="space-y-3 border-t border-border pt-4"
                aria-label="Picture-in-picture preferences"
              >
                <h3 className="text-sm font-medium">Picture-in-picture</h3>
                {props.pictureInPictureSettings}
              </section>
            )}
          </TabsContent>
        </Tabs>
        {props.feedback}
      </fieldset>
    </ZoomMeetingDialog>
  );
}
