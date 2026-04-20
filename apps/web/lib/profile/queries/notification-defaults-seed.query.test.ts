import { describe, expect, it, vi } from 'vitest';

import { seedSignupDefaultNotificationPreferences } from './notification-defaults-seed.query';

const { post, createApiClient } = vi.hoisted(() => {
  const post = vi.fn();
  const createApiClient = vi.fn(() => ({ post }));
  return { post, createApiClient };
});

vi.mock('@iconicedu/web/lib/api/http-client', () => ({
  createApiClient,
}));

describe('seedSignupDefaultNotificationPreferences', () => {
  it('seeds signup default preferences through the API', async () => {
    post.mockResolvedValue({ success: true, seeded: true });
    const supabase = {} as Parameters<typeof seedSignupDefaultNotificationPreferences>[0];

    await seedSignupDefaultNotificationPreferences(supabase, 'org-1', 'profile-1');

    expect(createApiClient).toHaveBeenCalledWith(supabase);
    expect(post).toHaveBeenCalledWith('/notification-preferences/seed-defaults', {
      orgId: 'org-1',
      profileId: 'profile-1',
    });
  });
});
