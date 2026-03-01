import {
  POSTHOG_EVENT_KEYS,
  buildPostHogCurrentUrl,
  buildPostHogIdentifyProperties,
  buildPostHogPageViewProperties,
  buildPostHogWebVitalProperties,
} from './posthog-events';

describe('posthog-events helpers', () => {
  it('builds a current url with origin and search', () => {
    expect(buildPostHogCurrentUrl('/iconic-academy/spaces', 'tab=sessions', 'https://app.example.com')).toBe(
      'https://app.example.com/iconic-academy/spaces?tab=sessions',
    );
  });

  it('returns path only when origin is missing', () => {
    expect(buildPostHogCurrentUrl('/iconic-academy/spaces', '', null)).toBe('/iconic-academy/spaces');
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

  it('builds web vital properties', () => {
    expect(
      buildPostHogWebVitalProperties({
        id: 'vital-1',
        name: 'CLS',
        value: 0.04,
        delta: 0.01,
        rating: 'good',
        navigationType: 'navigate',
      }),
    ).toEqual({
      metricId: 'vital-1',
      metricName: 'CLS',
      metricValue: 0.04,
      metricDelta: 0.01,
      rating: 'good',
      navigationType: 'navigate',
    });
  });

  it('exports stable event keys', () => {
    expect(POSTHOG_EVENT_KEYS.appLoaded).toBe('app_loaded');
    expect(POSTHOG_EVENT_KEYS.clientException).toBe('client_exception');
  });
});
