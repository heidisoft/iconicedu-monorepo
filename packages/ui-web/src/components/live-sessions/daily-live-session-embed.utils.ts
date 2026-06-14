import type { DailyInputVideoProcessorSettings } from '@daily-co/daily-js';

export type LiveSessionViewType = 'gallery' | 'speaker' | 'shared-content';

export const DAILY_BACKGROUND_PRESET_OPTIONS = [
  { value: 'none', label: 'No background' },
  { value: 'blur-soft', label: 'Blur' },
  { value: 'blur-strong', label: 'Strong blur' },
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
    input.remoteParticipantIds.length > 0 ? (input.localSessionId ?? null) : null;

  return {
    useOneToOneLayout:
      input.remoteParticipantIds.length <= 1 && Boolean(primaryParticipantId),
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

export type SessionErrorPayload = { title: string; description: string };

/**
 * Returns a human-readable title + description for any Daily/browser media error.
 * Handles the "blocked-by-browser: NotAllowedError: ..." pattern from Daily,
 * DOMException names, and network / device errors.
 */
export function parseSessionError(error: unknown, context?: string): SessionErrorPayload {
  const raw =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
  const lower = raw.toLowerCase();

  // ── Screen share / display capture ─────────────────────────────────────────
  if (
    context === 'screenshare' ||
    lower.includes('screenshare') ||
    lower.includes('getdisplaymedia') ||
    lower.includes('screen recording')
  ) {
    if (
      lower.includes('notallowederror') ||
      lower.includes('not allowed') ||
      lower.includes('blocked-by-browser')
    ) {
      return {
        title: 'Screen sharing blocked',
        description:
          'Your browser or system settings are preventing screen sharing. On macOS, go to System Settings → Privacy & Security → Screen & System Audio Recording and enable your browser. Then try again.',
      };
    }
    if (lower.includes('aborterror') || lower.includes('permission dismissed')) {
      return {
        title: 'Screen sharing cancelled',
        description:
          "You dismissed the screen sharing prompt. Click Share again when you're ready.",
      };
    }
    return {
      title: 'Screen sharing failed',
      description:
        'Unable to start screen sharing. Try again or use a different browser.',
    };
  }

  // ── Camera / microphone permission ─────────────────────────────────────────
  if (
    lower.includes('notallowederror') ||
    lower.includes('permission denied') ||
    lower.includes('blocked-by-browser')
  ) {
    return {
      title: 'Camera or microphone blocked',
      description:
        "Access to your camera or microphone was denied. Click the camera icon in your browser's address bar and allow access, then refresh.",
    };
  }

  // ── Device not found ───────────────────────────────────────────────────────
  if (
    lower.includes('notfounderror') ||
    lower.includes('device not found') ||
    lower.includes('no device')
  ) {
    return {
      title: 'Device not found',
      description:
        'No camera or microphone detected. Make sure your device is connected, then try again.',
    };
  }

  // ── Device in use by another app ───────────────────────────────────────────
  if (
    lower.includes('notreadableerror') ||
    lower.includes('could not start video') ||
    lower.includes('device in use') ||
    lower.includes('trackstarterror')
  ) {
    return {
      title: 'Device already in use',
      description:
        'Your camera or microphone is being used by another app. Close other video calls or apps and try again.',
    };
  }

  // ── Network / connection ───────────────────────────────────────────────────
  if (
    lower.includes('network') ||
    lower.includes('connection') ||
    lower.includes('timeout') ||
    lower.includes('ice')
  ) {
    return {
      title: 'Connection problem',
      description:
        'Having trouble connecting to the session. Check your internet connection and try again.',
    };
  }

  // ── Meeting full / token expired ───────────────────────────────────────────
  if (lower.includes('meeting-full') || lower.includes('meeting full')) {
    return {
      title: 'Session is full',
      description: 'This session has reached its participant limit.',
    };
  }
  if (lower.includes('token') || lower.includes('expired') || lower.includes('invalid')) {
    return {
      title: 'Session link expired',
      description: 'Your invite link is no longer valid. Ask the host for a fresh link.',
    };
  }

  // ── Generic fallback ───────────────────────────────────────────────────────
  return {
    title: 'Something went wrong',
    description:
      raw.length > 0 && raw.length < 180
        ? raw
        : 'An unexpected error occurred. Please try again.',
  };
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
  const parts = name?.trim().split(/\s+/).filter(Boolean).slice(0, 2) ?? [];

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

export function isDailyParticipantMicMuted(input: { audioState?: string | null }) {
  return input.audioState !== 'playable';
}
