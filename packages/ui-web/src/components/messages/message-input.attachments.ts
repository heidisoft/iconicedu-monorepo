export type ComposerAttachmentKind = 'image' | 'audio' | 'file';
export type ComposerRecordingStatus = 'recording' | 'paused';

export const MESSAGE_INPUT_FILE_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp,.pages,.numbers,.key,.zip,.rar,.7z,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/rtf,application/vnd.oasis.opendocument.text,application/vnd.oasis.opendocument.spreadsheet,application/vnd.oasis.opendocument.presentation,application/zip,application/x-rar-compressed,application/x-7z-compressed';

export const MESSAGE_INPUT_IMAGE_ACCEPT = 'image/*';

export const SHORT_AUDIO_RECORDING_MAX_MS = 60_000;

export function getComposerAttachmentKind(file: File): ComposerAttachmentKind {
  if (file.type.startsWith('image/')) {
    return 'image';
  }
  if (file.type.startsWith('audio/')) {
    return 'audio';
  }
  return 'file';
}

export function getDroppedAttachmentFiles(dataTransfer: DataTransfer | null | undefined) {
  if (!dataTransfer?.files?.length) {
    return [];
  }

  return Array.from(dataTransfer.files).filter((file) => {
    const kind = getComposerAttachmentKind(file);
    return kind === 'image' || kind === 'file';
  });
}

export function splitComposerAttachmentsByKind<
  T extends { kind: ComposerAttachmentKind }
>(attachments: T[]) {
  return {
    images: attachments.filter((attachment) => attachment.kind === 'image'),
    others: attachments.filter((attachment) => attachment.kind !== 'image'),
  };
}

export function formatComposerAttachmentSize(bytes?: number): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function formatRecordingDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function getRecordingElapsedMs(
  input: {
    status: ComposerRecordingStatus;
    startedAt: number;
    accumulatedMs: number;
  },
  now = Date.now(),
): number {
  if (input.status === 'paused') {
    return input.accumulatedMs;
  }

  return Math.max(0, input.accumulatedMs + (now - input.startedAt));
}

export function buildRecordedAudioFileName(now = Date.now(), mimeType?: string) {
  if (mimeType === 'audio/mp4' || mimeType === 'audio/m4a') {
    return `voice-message-${now}.m4a`;
  }
  if (mimeType === 'audio/mpeg') {
    return `voice-message-${now}.mp3`;
  }
  if (mimeType === 'audio/ogg') {
    return `voice-message-${now}.ogg`;
  }
  return `voice-message-${now}.webm`;
}

export function getSupportedAudioRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? '';
}

export async function resolveAudioDurationSeconds(
  file: File,
  fallbackSeconds?: number,
): Promise<number | undefined> {
  if (typeof Audio === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
    return fallbackSeconds;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const duration = await new Promise<number | null>((resolve) => {
      const audio = new Audio();
      const cleanup = () => {
        audio.removeAttribute('src');
        audio.load?.();
      };

      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        const nextDuration =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? Math.round(audio.duration)
            : null;
        cleanup();
        resolve(nextDuration);
      };
      audio.onerror = () => {
        cleanup();
        resolve(null);
      };
      audio.src = objectUrl;
    });

    return duration ?? fallbackSeconds;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
