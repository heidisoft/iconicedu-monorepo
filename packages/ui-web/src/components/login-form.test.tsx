import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LoginForm } from './login-form';

describe('LoginForm', () => {
  it('renders updated onboarding-focused copy', () => {
    render(<LoginForm />);

    expect(
      screen.getByRole('heading', { name: 'Welcome to ICONIC Academy' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Sign in or get started in seconds. We'll create your secure account automatically if you're new\./i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Continue with Google' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Continue with Apple' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send secure link' })).toBeInTheDocument();
  });

  it('calls the OAuth login handler with the selected provider', async () => {
    const onOAuthLogin = vi.fn();
    const user = userEvent.setup();
    render(<LoginForm onOAuthLogin={onOAuthLogin} />);

    await user.click(screen.getByRole('button', { name: 'Continue with Apple' }));

    expect(onOAuthLogin).toHaveBeenCalledWith('apple');
  });

  it('hides the social separator when no social provider is enabled', () => {
    render(<LoginForm enableGoogleSignIn={false} enableAppleSignIn={false} />);

    expect(
      screen.queryByRole('button', { name: 'Continue with Google' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Continue with Apple' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Or')).not.toBeInTheDocument();
  });

  it('renders a prominent message state container', () => {
    const { rerender } = render(<LoginForm errorMessage="Invalid email address" />);

    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('Invalid email address');
    expect(error).toHaveClass('rounded-2xl');
    expect(error).toHaveClass('border');

    rerender(<LoginForm statusMessage="Check your inbox for a secure link." />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Check your inbox for a secure link.',
    );
  });

  it('shows loading state when sending secure link', async () => {
    let resolveLogin: (() => void) | null = null;
    const onEmailLogin = () =>
      new Promise<void>((resolve) => {
        resolveLogin = resolve;
      });
    const user = userEvent.setup();
    render(<LoginForm onEmailLogin={onEmailLogin} />);

    await user.type(screen.getByLabelText('Email'), 'iconicedudev+parent@gmail.com');
    await user.click(screen.getByRole('button', { name: 'Send secure link' }));

    expect(screen.getByRole('button', { name: /Sending secure link/i })).toBeDisabled();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();

    await act(async () => {
      resolveLogin?.();
    });
  });
});
