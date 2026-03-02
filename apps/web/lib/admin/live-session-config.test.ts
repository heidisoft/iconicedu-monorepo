import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ADMIN_LIVE_SESSION_CONFIG,
  getAdminLiveSessionConfig,
  parseAdminLiveSessionConfig,
  toStoredLiveSessionConfig,
} from '@iconicedu/web/lib/admin/live-session-config';

describe('live-session-config', () => {
  it('parses a valid provider-neutral live session config', () => {
    expect(
      parseAdminLiveSessionConfig({
        enabled: true,
        provider: 'daily',
        mode: 'video',
      }),
    ).toEqual({
      enabled: true,
      provider: 'daily',
      mode: 'video',
      joinUrl: null,
    });
  });

  it('parses a custom provider join URL', () => {
    expect(
      parseAdminLiveSessionConfig({
        enabled: true,
        provider: 'custom',
        mode: 'video',
        joinUrl: ' https://meet.example.com/custom-room ',
      }),
    ).toEqual({
      enabled: true,
      provider: 'custom',
      mode: 'video',
      joinUrl: 'https://meet.example.com/custom-room',
    });
  });

  it('falls back to the default admin config for invalid values', () => {
    expect(getAdminLiveSessionConfig({ enabled: true, provider: 'invalid' })).toEqual(
      DEFAULT_ADMIN_LIVE_SESSION_CONFIG,
    );
  });

  it('stores null when live sessions are disabled', () => {
    expect(
      toStoredLiveSessionConfig({
        enabled: false,
        provider: 'daily',
        mode: 'video',
      }),
    ).toBeNull();
  });

  it('normalizes stored live session config when enabled', () => {
    expect(
      toStoredLiveSessionConfig({
        enabled: true,
        provider: 'jitsi',
        mode: null,
      }),
    ).toEqual({
      enabled: true,
      provider: 'jitsi',
      mode: 'video',
      joinUrl: null,
    });
  });

  it('stores a custom join URL when the custom provider is enabled', () => {
    expect(
      toStoredLiveSessionConfig({
        enabled: true,
        provider: 'custom',
        mode: 'audio',
        joinUrl: ' https://meet.example.com/direct ',
      }),
    ).toEqual({
      enabled: true,
      provider: 'custom',
      mode: 'audio',
      joinUrl: 'https://meet.example.com/direct',
    });
  });
});
