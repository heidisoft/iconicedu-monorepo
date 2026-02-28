import { describe, expect, it, vi } from 'vitest';

import {
  buildRecordedAudioFileName,
  formatComposerAttachmentSize,
  formatRecordingDuration,
  getDroppedAttachmentFiles,
  getRecordingElapsedMs,
  getComposerAttachmentKind,
  getSupportedAudioRecordingMimeType,
  MESSAGE_INPUT_FILE_ACCEPT,
  MESSAGE_INPUT_IMAGE_ACCEPT,
  resolveAudioDurationSeconds,
  splitComposerAttachmentsByKind,
} from './message-input.attachments';

describe('message-input attachment helpers', () => {
  it('detects image, audio, and generic file attachments', () => {
    expect(
      getComposerAttachmentKind(new File(['image'], 'photo.png', { type: 'image/png' })),
    ).toBe('image');
    expect(
      getComposerAttachmentKind(new File(['audio'], 'voice.webm', { type: 'audio/webm' })),
    ).toBe('audio');
    expect(
      getComposerAttachmentKind(
        new File(['document'], 'brief.pdf', { type: 'application/pdf' }),
      ),
    ).toBe('file');
  });

  it('returns dropped files for supported drag-and-drop attachments', () => {
    const imageFile = new File(['image'], 'photo.png', { type: 'image/png' });
    const docFile = new File(['doc'], 'brief.pdf', { type: 'application/pdf' });
    const files = getDroppedAttachmentFiles({
      files: [imageFile, docFile],
    } as unknown as DataTransfer);

    expect(files).toEqual([imageFile, docFile]);
    expect(
      getDroppedAttachmentFiles({
        files: [new File(['audio'], 'voice.webm', { type: 'audio/webm' })],
      } as unknown as DataTransfer),
    ).toEqual([]);
    expect(getDroppedAttachmentFiles(null)).toEqual([]);
  });

  it('splits image previews from other pending attachments', () => {
    expect(
      splitComposerAttachmentsByKind([
        { kind: 'image', id: 'image-1' },
        { kind: 'file', id: 'file-1' },
        { kind: 'audio', id: 'audio-1' },
        { kind: 'image', id: 'image-2' },
      ]),
    ).toEqual({
      images: [
        { kind: 'image', id: 'image-1' },
        { kind: 'image', id: 'image-2' },
      ],
      others: [
        { kind: 'file', id: 'file-1' },
        { kind: 'audio', id: 'audio-1' },
      ],
    });
  });

  it('formats attachment sizes into readable units', () => {
    expect(formatComposerAttachmentSize()).toBe('');
    expect(formatComposerAttachmentSize(512)).toBe('512.0 B');
    expect(formatComposerAttachmentSize(1024)).toBe('1.0 KB');
    expect(formatComposerAttachmentSize(1024 * 1024)).toBe('1.0 MB');
  });

  it('formats recording durations for the live preview', () => {
    expect(formatRecordingDuration(0)).toBe('0:00');
    expect(formatRecordingDuration(9)).toBe('0:09');
    expect(formatRecordingDuration(65)).toBe('1:05');
  });

  it('tracks recording elapsed time differently for recording and paused states', () => {
    expect(
      getRecordingElapsedMs(
        {
          status: 'recording',
          startedAt: 1_000,
          accumulatedMs: 2_000,
        },
        4_500,
      ),
    ).toBe(5_500);

    expect(
      getRecordingElapsedMs(
        {
          status: 'paused',
          startedAt: 1_000,
          accumulatedMs: 2_000,
        },
        9_000,
      ),
    ).toBe(2_000);
  });

  it('builds a recorded audio filename from the mime type', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);

    expect(buildRecordedAudioFileName(Date.now(), 'audio/mp4')).toBe(
      'voice-message-1700000000000.m4a',
    );
    expect(buildRecordedAudioFileName(Date.now(), 'audio/ogg')).toBe(
      'voice-message-1700000000000.ogg',
    );
    expect(buildRecordedAudioFileName(Date.now(), 'audio/webm')).toBe(
      'voice-message-1700000000000.webm',
    );
  });

  it('exports image and file accept lists for the composer', () => {
    expect(MESSAGE_INPUT_IMAGE_ACCEPT).toBe('image/*');
    expect(MESSAGE_INPUT_FILE_ACCEPT).toContain('.pdf');
    expect(MESSAGE_INPUT_FILE_ACCEPT).not.toContain('.mp4');
  });

  it('returns a supported audio recording mime type or an empty string', () => {
    expect(getSupportedAudioRecordingMimeType()).toMatch(/^(|audio\/)/);
  });

  it('falls back when audio metadata cannot be resolved', async () => {
    const file = new File(['audio'], 'voice.webm', { type: 'audio/webm' });
    const originalAudio = globalThis.Audio;
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;

    class MockAudio {
      duration = NaN;
      preload = '';
      onloadedmetadata: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
      removeAttribute() {}
      load() {}
    }

    // @ts-expect-error test shim
    globalThis.Audio = MockAudio;
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();

    await expect(resolveAudioDurationSeconds(file, 7)).resolves.toBe(7);

    globalThis.Audio = originalAudio;
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  });
});
