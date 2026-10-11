import type {
  AudioProcessingMode,
  BackgroundPreset,
} from './zoom-video/zoom-video-session.types';
import { BACKGROUND_PRESETS } from './zoom-video/zoom-video-session.constants';

export type MeetingMediaPreferences = {
  speakerId?: string;
  backgroundPreset: BackgroundPreset;
  audioProcessing: AudioProcessingMode;
  mirrored: boolean;
  hardwareAcceleration: { encode: boolean; decode: boolean };
};

export function isMeetingMediaPreferences(
  value: unknown,
): value is MeetingMediaPreferences {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<MeetingMediaPreferences>;
  return (
    (data.speakerId === undefined || typeof data.speakerId === 'string') &&
    ['none', 'blur', 'classroom', 'study'].includes(data.backgroundPreset ?? '') &&
    ['original', 'noiseSuppression'].includes(data.audioProcessing ?? '') &&
    typeof data.mirrored === 'boolean' &&
    typeof data.hardwareAcceleration?.encode === 'boolean' &&
    typeof data.hardwareAcceleration?.decode === 'boolean'
  );
}

export function backgroundImageUrl(preset: BackgroundPreset): string | undefined {
  return preset === 'none'
    ? undefined
    : preset === 'blur'
      ? 'blur'
      : BACKGROUND_PRESETS.find((item) => item.value === preset)?.src;
}
