import { describe, expect, it, vi } from 'vitest';

import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';

const { mockBuildOrgById } = vi.hoisted(() => ({
  mockBuildOrgById: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/org/builders/org.builder', () => ({
  buildOrgById: mockBuildOrgById,
}));

describe('resolveOrgDashboardPath', () => {
  it('returns slug based path when org exists', async () => {
    mockBuildOrgById.mockResolvedValueOnce({ id: 'org-1', slug: 'iconic-academy' });

    const path = await resolveOrgDashboardPath({} as never, 'org-1');

    expect(path).toBe('/iconic-academy');
  });

  it('falls back to /d when org cannot be resolved', async () => {
    mockBuildOrgById.mockResolvedValueOnce(null);

    const path = await resolveOrgDashboardPath({} as never, 'org-1');

    expect(path).toBe('/d');
  });
});
