import { describe, expect, it } from 'vitest';

import {
  DAILY_BACKGROUND_PRESET_OPTIONS,
  buildDailyDirectCallComposition,
  buildDailyParticipantIds,
  buildDailyBackgroundProcessor,
  buildDailySpeakingWaveformBars,
  getDailyBackgroundPresetValue,
  getDailyDeviceLabel,
  getDailyLiveSessionErrorMessage,
  getDailyParticipantInitials,
  getDailyParticipantLabel,
  isDirectLiveSessionLayout,
  isDailyParticipantMicMuted,
  isDailyParticipantSpeaking,
  shouldShowFullMeetingControls,
} from '@iconicedu/web/components/live-sessions/daily-live-session-embed.utils';

describe('daily-live-session-embed.utils', () => {
  it('prepends the local participant ahead of remote participants', () => {
    expect(
      buildDailyParticipantIds({
        localSessionId: 'local-session',
        remoteParticipantIds: ['remote-1', 'remote-2'],
      }),
    ).toEqual(['local-session', 'remote-1', 'remote-2']);
  });

  it('returns only remote participants when local session is missing', () => {
    expect(
      buildDailyParticipantIds({
        remoteParticipantIds: ['remote-1'],
      }),
    ).toEqual(['remote-1']);
  });

  it('builds a direct-call one-to-one composition with remote primary and local floating', () => {
    expect(
      buildDailyDirectCallComposition({
        localSessionId: 'local-session',
        remoteParticipantIds: ['remote-1'],
      }),
    ).toEqual({
      useOneToOneLayout: true,
      primaryParticipantId: 'remote-1',
      floatingParticipantId: 'local-session',
    });
  });

  it('uses the local participant as primary when they are alone in a direct call', () => {
    expect(
      buildDailyDirectCallComposition({
        localSessionId: 'local-session',
        remoteParticipantIds: [],
      }),
    ).toEqual({
      useOneToOneLayout: true,
      primaryParticipantId: 'local-session',
      floatingParticipantId: null,
    });
  });

  it('normalizes unknown join errors to a stable fallback message', () => {
    expect(getDailyLiveSessionErrorMessage(new Error('Daily join failed'))).toBe(
      'Daily join failed',
    );
    expect(getDailyLiveSessionErrorMessage(undefined)).toBe(
      'Failed to join live session',
    );
  });

  it('treats DMs and audio sessions as direct-call layouts', () => {
    expect(isDirectLiveSessionLayout({ channelKind: 'dm', mode: 'video' })).toBe(true);
    expect(isDirectLiveSessionLayout({ channelKind: 'channel', mode: 'audio' })).toBe(
      true,
    );
    expect(isDirectLiveSessionLayout({ channelKind: 'channel', mode: 'video' })).toBe(
      false,
    );
  });

  it('only shows full meeting controls for non-direct video sessions', () => {
    expect(shouldShowFullMeetingControls({ channelKind: 'channel', mode: 'video' })).toBe(
      true,
    );
    expect(shouldShowFullMeetingControls({ channelKind: 'dm', mode: 'video' })).toBe(
      false,
    );
    expect(shouldShowFullMeetingControls({ channelKind: 'channel', mode: 'audio' })).toBe(
      false,
    );
  });

  it('maps background processors to stable preset values', () => {
    expect(getDailyBackgroundPresetValue({ processor: { type: 'none' } })).toBe('none');
    expect(
      getDailyBackgroundPresetValue({
        processor: { type: 'background-blur', config: { strength: 0.6 } },
      }),
    ).toBe('blur-soft');
    expect(
      getDailyBackgroundPresetValue({
        processor: { type: 'background-blur', config: { strength: 0.9 } },
      }),
    ).toBe('blur-strong');
    expect(
      getDailyBackgroundPresetValue({
        processor: {
          type: 'background-image',
          config: { url: '/live-session-backgrounds/classroom.svg' },
        },
      }),
    ).toBe('classroom');
  });

  it('builds stable background processors from preset values', () => {
    expect(buildDailyBackgroundProcessor('none')).toEqual({ type: 'none' });
    expect(buildDailyBackgroundProcessor('blur-soft')).toEqual({
      type: 'background-blur',
      config: { strength: 0.55 },
    });
    expect(buildDailyBackgroundProcessor('study')).toEqual({
      type: 'background-image',
      config: { url: '/live-session-backgrounds/study.svg' },
    });
  });

  it('returns stable device labels when browser labels are empty', () => {
    expect(getDailyDeviceLabel({ label: '', kind: 'videoinput', index: 0 })).toBe(
      'Camera 1',
    );
    expect(getDailyDeviceLabel({ label: '', kind: 'audioinput', index: 1 })).toBe(
      'Microphone 2',
    );
    expect(getDailyDeviceLabel({ label: '', kind: 'audiooutput', index: 2 })).toBe(
      'Speaker 3',
    );
  });

  it('keeps the supported background presets list stable', () => {
    expect(DAILY_BACKGROUND_PRESET_OPTIONS.map((option) => option.value)).toEqual([
      'none',
      'blur-soft',
      'blur-strong',
      'classroom',
      'study',
    ]);
  });

  it('builds stable participant labels and initials for avatar fallback', () => {
    expect(getDailyParticipantLabel({ isLocal: true, userName: 'Jane Doe' })).toBe('You');
    expect(getDailyParticipantLabel({ userName: 'Jane Doe' })).toBe('Jane Doe');
    expect(getDailyParticipantInitials('Jane Doe')).toBe('JD');
    expect(getDailyParticipantInitials('')).toBe('P');
  });

  it('uses a stable speaking threshold for avatar talk-state', () => {
    expect(isDailyParticipantSpeaking(0.05)).toBe(false);
    expect(isDailyParticipantSpeaking(0.25)).toBe(true);
  });

  it('returns compact waveform bars for idle vs speaking states', () => {
    expect(buildDailySpeakingWaveformBars(false)).toEqual([4, 8, 6, 10, 7]);
    expect(buildDailySpeakingWaveformBars(true)).toEqual([10, 20, 14, 24, 16]);
  });

  it('treats non-playable audio tracks as muted', () => {
    expect(isDailyParticipantMicMuted({ audioState: 'playable' })).toBe(false);
    expect(isDailyParticipantMicMuted({ audioState: 'off' })).toBe(true);
    expect(isDailyParticipantMicMuted({ audioState: 'blocked' })).toBe(true);
  });
});
