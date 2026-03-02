import type { DailyInputVideoProcessorSettings } from '@daily-co/daily-js';

export const DAILY_BACKGROUND_PRESET_OPTIONS = [
  { value: 'none', label: 'No background' },
  { value: 'blur-soft', label: 'Blur background' },
  { value: 'blur-strong', label: 'Strong blur' },
  { value: 'classroom', label: 'Classroom' },
  { value: 'study', label: 'Study room' },
] as const;

export type DailyBackgroundPresetValue =
  (typeof DAILY_BACKGROUND_PRESET_OPTIONS)[number]['value'];

export function buildDailyParticipantIds(input: {
  localSessionId?: string | null;
  remoteParticipantIds: string[];
}) {
  const participantIds = [...input.remoteParticipantIds];

  if (input.localSessionId) {
    participantIds.unshift(input.localSessionId);
  }

  return participantIds;
}

export function buildDailyDirectCallComposition(input: {
  localSessionId?: string | null;
  remoteParticipantIds: string[];
}) {
  const primaryParticipantId =
    input.remoteParticipantIds[0] ?? input.localSessionId ?? null;
  const floatingParticipantId =
    input.remoteParticipantIds.length > 0 ? input.localSessionId ?? null : null;

  return {
    useOneToOneLayout:
      input.remoteParticipantIds.length <= 1 &&
      Boolean(primaryParticipantId),
    primaryParticipantId,
    floatingParticipantId,
  };
}

export function getDailyLiveSessionErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Failed to join live session';
}

export function isDirectLiveSessionLayout(input: {
  channelKind?: string | null;
  mode?: 'video' | 'audio' | null;
}) {
  return (
    input.mode === 'audio' ||
    input.channelKind === 'dm' ||
    input.channelKind === 'group_dm'
  );
}

export function shouldShowFullMeetingControls(input: {
  channelKind?: string | null;
  mode?: 'video' | 'audio' | null;
}) {
  return !isDirectLiveSessionLayout(input) && input.mode !== 'audio';
}

export function getDailyBackgroundPresetValue(input: {
  processor?: {
    type?: string;
    config?: {
      strength?: number;
      url?: string;
    };
  } | null;
}): DailyBackgroundPresetValue {
  const processor = input.processor;

  if (!processor || processor.type === 'none') {
    return 'none';
  }

  if (processor.type === 'background-blur') {
    return (processor.config?.strength ?? 0.6) >= 0.8 ? 'blur-strong' : 'blur-soft';
  }

  if (processor.type === 'background-image') {
    if (processor.config?.url?.includes('/live-session-backgrounds/classroom.svg')) {
      return 'classroom';
    }

    if (processor.config?.url?.includes('/live-session-backgrounds/study.svg')) {
      return 'study';
    }
  }

  return 'none';
}

export function buildDailyBackgroundProcessor(
  preset: DailyBackgroundPresetValue,
): DailyInputVideoProcessorSettings {
  switch (preset) {
    case 'blur-soft':
      return { type: 'background-blur', config: { strength: 0.55 } };
    case 'blur-strong':
      return { type: 'background-blur', config: { strength: 0.9 } };
    case 'classroom':
      return {
        type: 'background-image',
        config: { url: '/live-session-backgrounds/classroom.svg' },
      };
    case 'study':
      return {
        type: 'background-image',
        config: { url: '/live-session-backgrounds/study.svg' },
      };
    default:
      return { type: 'none' };
  }
}

export function getDailyDeviceLabel(input: {
  label?: string | null;
  kind?: string | null;
  index: number;
}) {
  const label = input.label?.trim();

  if (label) {
    return label;
  }

  const prefix =
    input.kind === 'audioinput'
      ? 'Microphone'
      : input.kind === 'audiooutput'
        ? 'Speaker'
        : 'Camera';

  return `${prefix} ${input.index + 1}`;
}

export function getDailyParticipantLabel(input: {
  isLocal?: boolean;
  userName?: string | null;
}) {
  const trimmedName = input.userName?.trim();

  if (input.isLocal) {
    return 'You';
  }

  return trimmedName || 'Participant';
}

export function getDailyParticipantInitials(name?: string | null) {
  const parts =
    name
      ?.trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2) ?? [];

  if (parts.length === 0) {
    return 'P';
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

export function isDailyParticipantSpeaking(volume: number) {
  return volume > 0.18;
}

export function buildDailySpeakingWaveformBars(isSpeaking: boolean) {
  return isSpeaking ? [10, 20, 14, 24, 16] : [4, 8, 6, 10, 7];
}

export function isDailyParticipantMicMuted(input: {
  audioState?: string | null;
}) {
  return input.audioState !== 'playable';
}
