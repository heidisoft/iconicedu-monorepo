import { describe, expect, it } from 'vitest';

import { buildAudioWaveformBars, formatAudioTime, resolveAudioDuration } from './audio-message';

describe('audio-message helpers', () => {
  it('formats audio time for the player labels', () => {
    expect(formatAudioTime(0)).toBe('0:00');
    expect(formatAudioTime(9)).toBe('0:09');
    expect(formatAudioTime(65)).toBe('1:05');
  });

  it('builds bounded waveform bars from message waveform data', () => {
    expect(buildAudioWaveformBars([0.1, 0.5, 1.4, -2], 4)).toEqual([
      0.2,
      0.5,
      1,
      0.2,
    ]);
  });

  it('keeps fallback waveform bars above the minimum visible threshold', () => {
    const bars = buildAudioWaveformBars([0, 0.05, 0.1], 3);

    expect(bars).toEqual([0.2, 0.2, 0.2]);
  });

  it('generates fallback waveform bars when no waveform exists', () => {
    const bars = buildAudioWaveformBars(undefined, 6);

    expect(bars).toHaveLength(6);
    expect(bars.every((value) => value >= 0.28 && value <= 0.92)).toBe(true);
  });

  it('resolves the displayed duration from message payload or loaded metadata', () => {
    expect(resolveAudioDuration(12, 0)).toBe(12);
    expect(resolveAudioDuration(undefined, 9.2)).toBe(9.2);
    expect(resolveAudioDuration(8, 14)).toBe(14);
    expect(resolveAudioDuration(undefined, undefined)).toBe(0);
  });

  it('does not require message audio src to compute helper output', () => {
    expect(formatAudioTime(125)).toBe('2:05');
  });
});
