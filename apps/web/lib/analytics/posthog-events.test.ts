import {
  POSTHOG_EVENT_KEYS,
  buildPostHogCurrentUrl,
  buildPostHogIdentifyProperties,
  buildPostHogPageViewProperties,
} from './posthog-events';

describe('posthog-events helpers', () => {
  it('builds a current url with origin and search', () => {
    expect(
      buildPostHogCurrentUrl(
        '/iconic-academy/spaces',
        'tab=sessions',
        'https://app.example.com',
      ),
    ).toBe('https://app.example.com/iconic-academy/spaces?tab=sessions');
  });

  it('returns path only when origin is missing', () => {
    expect(buildPostHogCurrentUrl('/iconic-academy/spaces', '', null)).toBe(
      '/iconic-academy/spaces',
    );
  });

  it('builds pageview properties', () => {
    expect(
      buildPostHogPageViewProperties({
        pathname: '/iconic-academy/messages',
        search: 'thread=1',
        origin: 'https://app.example.com',
      }),
    ).toEqual({
      $current_url: 'https://app.example.com/iconic-academy/messages?thread=1',
      pathname: '/iconic-academy/messages',
      search: '?thread=1',
    });
  });

  it('builds identify properties without empty values', () => {
    expect(
      buildPostHogIdentifyProperties({
        email: 'user@example.com',
        accountId: 'account-1',
        orgId: 'org-1',
        orgSlug: null,
      }),
    ).toEqual({
      email: 'user@example.com',
      accountId: 'account-1',
      orgId: 'org-1',
    });
  });

  it('exports stable event keys', () => {
    expect(POSTHOG_EVENT_KEYS.appLoaded).toBe('app_loaded');
    expect(POSTHOG_EVENT_KEYS.authTelemetry).toBe('auth_telemetry');
  });
});
