import { describe, expect, it, vi } from 'vitest';

import { hasAnyActiveOrgs } from '@iconicedu/web/lib/org/has-orgs';

describe('hasAnyActiveOrgs', () => {
  it('returns true when active orgs exist', async () => {
    const is = vi.fn().mockResolvedValue({ count: 1, error: null });
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          is,
        })),
      })),
    };

    await expect(hasAnyActiveOrgs(supabase as never)).resolves.toBe(true);
  });

  it('returns false when no active org exists', async () => {
    const is = vi.fn().mockResolvedValue({ count: 0, error: null });
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          is,
        })),
      })),
    };

    await expect(hasAnyActiveOrgs(supabase as never)).resolves.toBe(false);
  });
});
