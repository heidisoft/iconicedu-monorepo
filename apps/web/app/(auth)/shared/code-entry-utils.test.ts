import { describe, expect, it } from 'vitest';

import {
  buildAuthEntryPath,
  buildCodeEntryPath,
  getEmailOtpType,
  shouldCreateUserForIntent,
} from './code-entry-utils';

describe('buildCodeEntryPath', () => {
  it('builds org-scoped code path', () => {
    expect(
      buildCodeEntryPath({
        email: 'iconicedudev+parent@gmail.com',
        intent: 'login',
        orgSlug: 'iconic-academy',
      }),
    ).toBe(
      '/code?email=iconicedudev%2Bparent%40gmail.com&intent=login&org=iconic-academy',
    );
  });

  it('builds global code path', () => {
    expect(
      buildCodeEntryPath({
        email: 'iconicedudev+admin@gmail.com',
        intent: 'get-started',
      }),
    ).toBe('/code?email=iconicedudev%2Badmin%40gmail.com&intent=get-started');
  });
});

describe('buildAuthEntryPath', () => {
  it('builds org login path', () => {
    expect(buildAuthEntryPath('login', 'iconic-academy')).toBe('/iconic-academy/login');
  });

  it('builds org get started path', () => {
    expect(buildAuthEntryPath('get-started', 'iconic-academy')).toBe(
      '/iconic-academy/get-started',
    );
  });

  it('falls back to global get started path', () => {
    expect(buildAuthEntryPath('get-started')).toBe('/get-started');
  });
});

describe('auth intent helpers', () => {
  it('maps login to email OTP without user creation', () => {
    expect(getEmailOtpType('login')).toBe('email');
    expect(shouldCreateUserForIntent('login')).toBe(false);
  });

  it('maps get started to email OTP with user creation', () => {
    expect(getEmailOtpType('get-started')).toBe('email');
    expect(shouldCreateUserForIntent('get-started')).toBe(true);
  });
});
