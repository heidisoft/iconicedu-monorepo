// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
const mockVerifyOtp = vi.fn();
const mockSignInWithOtp = vi.fn();
const mockSearchParams = new URLSearchParams({
  email: 'iconicedudev+parent@gmail.com',
  intent: 'login',
});

vi.mock('next/navigation', async () => {
  const actual =
    await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    useRouter: () => ({ replace: mockReplace }),
    useSearchParams: () => mockSearchParams,
  };
});

vi.mock('@iconicedu/web/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      verifyOtp: mockVerifyOtp,
      signInWithOtp: mockSignInWithOtp,
    },
  }),
}));

vi.mock('@iconicedu/ui-web/components/branding/site-logo-full', () => ({
  SiteLogoFull: () => <div data-testid="site-logo" />,
}));

vi.mock('@iconicedu/ui-web/components/turnstile', () => ({
  Turnstile: ({ onTokenChange }: { onTokenChange: (token: string) => void }) => (
    <button type="button" onClick={() => onTokenChange('turnstile-token')}>
      Complete Turnstile
    </button>
  ),
}));

vi.mock('@iconicedu/ui-web/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@iconicedu/ui-web/ui/field', () => ({
  Field: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FieldDescription: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  FieldGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FieldLabel: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock('@iconicedu/ui-web/ui/input-otp', () => ({
  InputOTP: ({
    value,
    onChange,
    id,
  }: {
    value: string;
    onChange: (value: string) => void;
    id: string;
  }) => (
    <input
      id={id}
      aria-label="Verification code"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
  InputOTPGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  InputOTPSeparator: () => <span>-</span>,
  InputOTPSlot: () => null,
}));

import CodeEntryClient from './code-entry-client';

describe('CodeEntryClient', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockVerifyOtp.mockReset();
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockSignInWithOtp.mockReset();
    mockSignInWithOtp.mockResolvedValue({ error: null });
  });

  it('automatically verifies once all 6 digits are entered', async () => {
    render(<CodeEntryClient />);

    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '123456' },
    });

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        email: 'iconicedudev+parent@gmail.com',
        token: '123456',
        type: 'email',
      });
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/auth/callback?intent=login');
    });
  });

  it('requires a fresh Turnstile token when resending an OTP', async () => {
    vi.useFakeTimers();
    render(<CodeEntryClient turnstileSiteKey="site-key" />);

    for (let second = 0; second < 30; second += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
    }
    const resendButton = screen.getByRole('button', { name: 'Resend' });
    expect(resendButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Complete Turnstile' }));
    expect(resendButton).toBeEnabled();
    await act(async () => {
      fireEvent.click(resendButton);
    });
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'iconicedudev+parent@gmail.com',
      options: {
        shouldCreateUser: false,
        captchaToken: 'turnstile-token',
      },
    });
    vi.useRealTimers();
  });
});
