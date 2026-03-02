import { describe, expect, it } from 'vitest';

import { ADMIN_LIVE_SESSION_PROVIDER_OPTIONS } from '@iconicedu/web/lib/admin/live-session-config-options';

describe('live-session-config-options', () => {
  it('only exposes daily and custom provider options for admin forms', () => {
    expect(ADMIN_LIVE_SESSION_PROVIDER_OPTIONS).toEqual([
      { value: 'daily', label: 'Daily Meetings' },
      { value: 'custom', label: 'External' },
    ]);
  });
});
