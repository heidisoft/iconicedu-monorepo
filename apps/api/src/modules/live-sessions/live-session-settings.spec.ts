import { DEFAULT_LIVE_SESSION_SETTINGS } from '@iconicedu/shared-types';
import { parseLiveSessionSettings, settingsFromSnapshot } from './live-session-settings';

describe('meeting policy validation', () => {
  it('preserves legacy defaults without automatic recording', () => {
    expect(settingsFromSnapshot(null)).toEqual(DEFAULT_LIVE_SESSION_SETTINGS);
    expect(parseLiveSessionSettings({})).toEqual(DEFAULT_LIVE_SESSION_SETTINGS);
  });
  it('accepts read-only messages and locked automatic recording', () => {
    const policy = parseLiveSessionSettings({
      recording: { autoStart: true, allowStop: false },
      messages: { enabled: false },
    });
    expect(policy.recording).toEqual({
      enabled: true,
      autoStart: true,
      allowStop: false,
    });
    expect(policy.messages).toEqual({ visible: true, enabled: false });
  });
  it.each([
    null,
    [],
    { whiteboard: { enabled: 'false' } },
    { unexpected: true },
    { constructor: {} },
    { recording: { enabled: false, autoStart: true } },
    { messages: { visible: false, enabled: true } },
  ])('rejects malformed or inconsistent settings %p', (value) => {
    expect(() => parseLiveSessionSettings(value)).toThrow();
  });
  it('returns an independent default for each meeting', () => {
    const settings = settingsFromSnapshot(null);
    settings.recording.autoStart = true;
    expect(settingsFromSnapshot(null).recording.autoStart).toBe(false);
  });
});

describe('meeting admission settings', () => {
  it.each(['open', 'trusted', 'restricted'])(
    'accepts %s independently of invitations',
    (mode) => {
      expect(
        parseLiveSessionSettings({ access: { mode }, cohosts: { enabled: true } }),
      ).toMatchObject({ access: { mode }, cohosts: { enabled: true } });
    },
  );
  it('rejects unknown modes and malformed co-host permissions', () => {
    expect(() => parseLiveSessionSettings({ access: { mode: 'public' } })).toThrow(
      'Invalid admission mode',
    );
    expect(() => parseLiveSessionSettings({ access: { mode: ['open'] } })).toThrow(
      'Invalid admission mode',
    );
    expect(() => parseLiveSessionSettings({ cohosts: { enabled: 'yes' } })).toThrow();
  });
});
