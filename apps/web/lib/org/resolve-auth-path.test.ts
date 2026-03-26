import { describe, expect, it, vi } from 'vitest';

const { mockGetDefaultOrg, mockResolveOrgDashboardPath } = vi.hoisted(() => ({
  mockGetDefaultOrg: vi.fn(),
  mockResolveOrgDashboardPath: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/org/queries/org.query', () => ({
  getDefaultOrg: mockGetDefaultOrg,
}));

vi.mock('@iconicedu/web/lib/org/resolve-dashboard-path', () => ({
  resolveOrgDashboardPath: mockResolveOrgDashboardPath,
}));

import {
  resolveDefaultOrgLoginPath,
  resolveOrgLoginPath,
} from '@iconicedu/web/lib/org/resolve-auth-path';

describe('resolveDefaultOrgLoginPath', () => {
  it('returns default org login path when org exists', async () => {
    mockGetDefaultOrg.mockResolvedValueOnce({ data: { slug: 'acme' } });
    await expect(resolveDefaultOrgLoginPath({} as never)).resolves.toBe('/acme/login');
  });

  it('returns fallback when no default org exists', async () => {
    mockGetDefaultOrg.mockResolvedValueOnce({ data: null });
    await expect(resolveDefaultOrgLoginPath({} as never, '/')).resolves.toBe('/');
  });

  it('defaults to the /i entry path when no org exists', async () => {
    mockGetDefaultOrg.mockResolvedValueOnce({ data: null });
    await expect(resolveDefaultOrgLoginPath({} as never)).resolves.toBe('/i');
  });
});

describe('resolveOrgLoginPath', () => {
  it('returns org-scoped login path', async () => {
    mockResolveOrgDashboardPath.mockResolvedValueOnce('/acme');
    await expect(resolveOrgLoginPath({} as never, 'org-1')).resolves.toBe('/acme/login');
  });

  it('returns fallback when dashboard path falls back', async () => {
    mockResolveOrgDashboardPath.mockResolvedValueOnce('/get-started');
    await expect(resolveOrgLoginPath({} as never, 'org-1')).resolves.toBe('/get-started');
  });
});
