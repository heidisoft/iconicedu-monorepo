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

// Mocked Turnstile widget: `configured` mirrors a set site key; `emit` pushes a
// token through the live `onTokenChange`.
const turnstileState = vi.hoisted(() => ({
  configured: false,
  emit: null as null | ((token: string | null) => void),
}));

vi.mock('../shared/turnstile-field', async () => {
  const react = await import('react');
  return {
    isTurnstileConfigured: () => turnstileState.configured,
    TurnstileField: react.forwardRef(function MockTurnstileField(
      { onTokenChange }: { onTokenChange: (token: string | null) => void },
      ref: react.Ref<{ reset: () => void }>,
    ) {
      react.useImperativeHandle(ref, () => ({ reset: () => onTokenChange(null) }), [
        onTokenChange,
      ]);
      react.useEffect(() => {
        turnstileState.emit = onTokenChange;
        return () => {
          turnstileState.emit = null;
        };
      }, [onTokenChange]);
      return null;
    }),
  };
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

// The resend button starts behind a 30s cooldown driven by a self-rescheduling
// setTimeout; advance it one second at a time so React flushes each tick.
async function clearResendCooldown() {
  for (let i = 0; i < 31; i += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
  }
}

describe('CodeEntryClient', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockVerifyOtp.mockReset();
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockSignInWithOtp.mockReset();
    mockSignInWithOtp.mockResolvedValue({ error: null });
    turnstileState.configured = false;
    turnstileState.emit = null;
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

  it('resends without a captchaToken when Turnstile is not configured', async () => {
    vi.useFakeTimers();
    try {
      render(<CodeEntryClient />);
      await clearResendCooldown();

      const resendButton = screen.getByRole('button', { name: 'Resend' });
      expect(resendButton).toBeEnabled();
      await act(async () => {
        fireEvent.click(resendButton);
      });

      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        email: 'iconicedudev+parent@gmail.com',
        options: { shouldCreateUser: false, captchaToken: undefined },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('blocks resend until Turnstile yields a token, then forwards it', async () => {
    turnstileState.configured = true;
    vi.useFakeTimers();
    try {
      render(<CodeEntryClient />);
      await clearResendCooldown();

      const resendButton = screen.getByRole('button', { name: 'Resend' });
      // Cooldown is over but there is still no captcha token.
      expect(resendButton).toBeDisabled();

      act(() => turnstileState.emit?.('tk-live'));
      expect(resendButton).toBeEnabled();

      await act(async () => {
        fireEvent.click(resendButton);
      });

      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        email: 'iconicedudev+parent@gmail.com',
        options: { shouldCreateUser: false, captchaToken: 'tk-live' },
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
