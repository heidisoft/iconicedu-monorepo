import { describe, expect, it, vi } from 'vitest';

import { resolveFamilyInviteRedirectUrl } from '@iconicedu/web/lib/family/queries/invite-redirect';

const { mockResolveAppUrl } = vi.hoisted(() => ({
  mockResolveAppUrl: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/config/app-url', () => ({
  resolveAppUrl: mockResolveAppUrl,
}));

describe('resolveFamilyInviteRedirectUrl', () => {
  it('appends /auth/callback to app url', () => {
    mockResolveAppUrl.mockReturnValueOnce('http://localhost:3000');

    expect(resolveFamilyInviteRedirectUrl()).toBe('http://localhost:3000/auth/callback');
  });
});
