import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LoginForm } from './login-form';

describe('LoginForm', () => {
  it('renders updated onboarding-focused copy', () => {
    render(<LoginForm />);

    expect(
      screen.getByRole('heading', {
        name: 'One place for lessons, schedules, and progress.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Welcome to ICONIC Academy')).toBeInTheDocument();
    expect(
      screen.getByText(
        /No password needed. We'll email you a secure one-time code to sign in\./i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Continue with Google' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Continue with Apple' }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@email.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.getByText('Qualified, vetted tutors')).toBeInTheDocument();
    expect(
      screen.getByText('Schedules, sessions & homework in one place'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Real-time messages, updates & payments'),
    ).toBeInTheDocument();
    expect(screen.getByText(/By continuing, you agree to our/i)).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('button', { name: /Sending code/i })).toBeDisabled();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();

    await act(async () => {
      resolveLogin?.();
    });
  });
});
