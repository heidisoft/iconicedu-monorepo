'use client';

import type { ReactNode } from 'react';
import { SharePrivilege } from '@zoom/videosdk';
import { Image as ImageIcon, ImageOff, Settings } from 'lucide-react';
import { Label } from '@iconicedu/ui-web/ui/label';
import { RadioGroup, RadioGroupItem } from '@iconicedu/ui-web/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web/ui/select';
import { Switch } from '@iconicedu/ui-web/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@iconicedu/ui-web/ui/tabs';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { BACKGROUND_PRESETS } from './zoom-video-session.constants';
import type {
  AudioProcessingMode,
  BackgroundPreset,
  MediaDeviceOption,
} from './zoom-video-session.types';
import { MeetingControlButton } from './zoom-meeting-controls';
import { ZoomMeetingDialog } from './zoom-meeting-dialog';

function DeviceSelect({
  label,
  devices,
  selectedId,
  onChange,
}: {
  label: string;
  devices: MediaDeviceOption[];
  selectedId: string | null;
  onChange: (id: string) => void;
}) {
  if (!devices.length) return null;
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

type Props = {
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
      title="Call settings"
      description="Manage video, audio and how your call appears."
      trigger={
        !props.hideTrigger ? (
          <MeetingControlButton label="Settings" tone={props.open ? 'active' : 'neutral'}>
            <Settings className="size-4" />
          </MeetingControlButton>
        ) : undefined
      }
    >
      <Tabs defaultValue="audio">
        <TabsList className="w-full">
          <TabsTrigger value="audio">Audio</TabsTrigger>
          <TabsTrigger value="video">Video</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
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
                  <RadioGroupItem value="noiseSuppression" id="audio-noise-suppression" />
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
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => props.onSelectBackground('none')}
                  className={cn(
                    'flex aspect-video cursor-pointer items-center justify-center gap-1.5 rounded-lg border text-xs text-muted-foreground',
                    props.backgroundPreset === 'none'
                      ? 'border-primary ring-1 ring-primary'
                      : 'border-border',
                  )}
                >
                  <ImageOff className="size-3.5" />
                  None
                </button>
                <button
                  type="button"
                  onClick={() => props.onSelectBackground('blur')}
                  className={cn(
                    'flex aspect-video cursor-pointer items-center justify-center gap-1.5 rounded-lg border text-xs text-muted-foreground',
                    props.backgroundPreset === 'blur'
                      ? 'border-primary ring-1 ring-primary'
                      : 'border-border',
                  )}
                >
                  <ImageIcon className="size-3.5" />
                  Blur
                </button>
                {BACKGROUND_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => props.onSelectBackground(preset.value)}
                    className={cn(
                      'relative aspect-video cursor-pointer overflow-hidden rounded-lg border',
                      props.backgroundPreset === preset.value
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
    </ZoomMeetingDialog>
  );
}
