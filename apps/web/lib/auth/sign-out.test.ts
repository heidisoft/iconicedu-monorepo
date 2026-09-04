import { describe, expect, it, vi } from 'vitest';
import { signOutCurrentSession } from '@iconicedu/web/lib/auth/sign-out';

describe('signOutCurrentSession', () => {
  it('signs out only the current browser session', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });

    await signOutCurrentSession({ auth: { signOut } } as never);

    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('throws returned Supabase errors', async () => {
    const error = new Error('Sign-out failed');
    const signOut = vi.fn().mockResolvedValue({ error });

    await expect(signOutCurrentSession({ auth: { signOut } } as never)).rejects.toBe(
      error,
    );
  });
});
