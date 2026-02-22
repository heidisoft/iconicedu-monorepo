import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signInWithOtp, signInWithOAuth, trackAuthTelemetry } = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
  trackAuthTelemetry: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      signInWithOtp,
      signInWithOAuth,
    },
  })),
}));

vi.mock('@iconicedu/web/lib/telemetry/auth-events', () => ({
  trackAuthTelemetry,
}));

vi.mock('@iconicedu/ui-web', () => ({
  LoginForm: ({
    onEmailLogin,
    onOAuthLogin,
  }: {
    onEmailLogin?: (email: string) => Promise<void> | void;
    onOAuthLogin?: (provider: 'apple' | 'google') => Promise<void> | void;
  }) => (
    <div>
      <button onClick={() => onEmailLogin?.('parent@example.com')}>email-login</button>
      <button onClick={() => onOAuthLogin?.('google')}>google-login</button>
    </div>
  ),
}));

import LoginClient from '@iconicedu/web/app/(auth)/login/login-client';

describe('LoginClient', () => {
  beforeEach(() => {
    signInWithOtp.mockReset();
    signInWithOAuth.mockReset();
    trackAuthTelemetry.mockReset();
    signInWithOtp.mockResolvedValue({ error: null });
    signInWithOAuth.mockResolvedValue({ error: null });
    trackAuthTelemetry.mockResolvedValue(undefined);
  });

  it('uses local callback for auth redirects', async () => {
    const user = userEvent.setup();
    render(<LoginClient />);

    await user.click(screen.getByRole('button', { name: 'email-login' }));
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'parent@example.com',
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    await user.click(screen.getByRole('button', { name: 'google-login' }));
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  });
});
