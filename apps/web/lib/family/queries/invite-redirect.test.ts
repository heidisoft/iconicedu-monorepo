import { describe, expect, it, vi } from 'vitest';

import { resolveFamilyInviteRedirectUrl } from '@iconicedu/web/lib/family/queries/invite-redirect';

const { mockResolveAppUrl } = vi.hoisted(() => ({
  mockResolveAppUrl: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/config/app-url', () => ({
  resolveAppUrl: mockResolveAppUrl,
}));

describe('resolveFamilyInviteRedirectUrl', () => {
  it('builds org-scoped callback redirect with get-started intent', () => {
    mockResolveAppUrl.mockReturnValueOnce('http://localhost:3000');

    expect(resolveFamilyInviteRedirectUrl('iconic-academy')).toBe(
      'http://localhost:3000/auth/callback?org=iconic-academy&intent=get-started',
    );
  });
});
