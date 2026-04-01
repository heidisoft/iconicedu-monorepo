// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
const mockVerifyOtp = vi.fn();
const mockSearchParams = new URLSearchParams({
  email: 'parent@example.com',
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
      signInWithOtp: vi.fn(),
    },
  }),
}));

vi.mock('@iconicedu/web/lib/telemetry/auth-events', () => ({
  trackAuthTelemetry: vi.fn(async () => undefined),
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

describe('CodeEntryClient', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockVerifyOtp.mockReset();
    mockVerifyOtp.mockResolvedValue({ error: null });
  });

  it('automatically verifies once all 6 digits are entered', async () => {
    render(<CodeEntryClient />);

    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '123456' },
    });

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        email: 'parent@example.com',
        token: '123456',
        type: 'email',
      });
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/auth/callback?intent=login');
    });
  });
});
