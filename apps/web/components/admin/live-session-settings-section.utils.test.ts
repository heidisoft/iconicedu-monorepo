import { describe, expect, it } from 'vitest';

import {
  shouldShowLiveSessionJoinUrlField,
  withNextLiveSessionProvider,
} from '@iconicedu/web/components/admin/live-session-settings-section.utils';

describe('live-session-settings-section.utils', () => {
  it('shows the join url field only for enabled custom providers', () => {
    expect(
      shouldShowLiveSessionJoinUrlField({
        enabled: true,
        provider: 'custom',
        mode: 'video',
        joinUrl: '',
      }),
    ).toBe(true);

    expect(
      shouldShowLiveSessionJoinUrlField({
        enabled: true,
        provider: 'daily',
        mode: 'video',
        joinUrl: null,
      }),
    ).toBe(false);
  });

  it('clears join url when switching away from the custom provider', () => {
    expect(
      withNextLiveSessionProvider(
        {
          enabled: true,
          provider: 'custom',
          mode: 'video',
          joinUrl: 'https://meet.example.com/room',
        },
        'daily',
      ),
    ).toEqual({
      enabled: true,
      provider: 'daily',
      mode: 'video',
      joinUrl: null,
    });
  });
});
