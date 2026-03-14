import { describe, expect, it } from 'vitest';

import {
  buildOrgInviteRedirectUrl,
  ensureOrgCallbackRedirect,
} from './invite-user.utils';

describe('invite-user redirect helpers', () => {
  it('builds callback url with org slug and get-started intent', () => {
    const url = buildOrgInviteRedirectUrl({
      baseUrl: 'https://app.example.com',
      profileKind: 'guardian',
      orgSlug: 'iconic-academy',
      intent: 'get-started',
    });

    expect(url).toBe(
      'https://app.example.com/auth/callback?profileKind=guardian&org=iconic-academy&intent=get-started',
    );
  });

  it('ensures org + intent are present on callback redirects', () => {
    const url = ensureOrgCallbackRedirect(
      'https://app.example.com/auth/callback?profileKind=staff',
      'acme-org',
      'get-started',
    );

    expect(url).toContain('/auth/callback?');
    expect(url).toContain('org=acme-org');
    expect(url).toContain('intent=get-started');
  });

  it('supports login intent for existing-account magic links', () => {
    const url = ensureOrgCallbackRedirect(
      'https://app.example.com/auth/callback?profileKind=staff',
      'acme-org',
      'login',
    );

    expect(url).toContain('/auth/callback?');
    expect(url).toContain('org=acme-org');
    expect(url).toContain('intent=login');
  });

  it('leaves non-callback redirects unchanged', () => {
    expect(
      ensureOrgCallbackRedirect(
        'https://app.example.com/welcome',
        'acme-org',
        'get-started',
      ),
    ).toBe('https://app.example.com/welcome');
  });
});
