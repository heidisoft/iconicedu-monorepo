import React from 'react';
import { render, screen } from '@testing-library/react';

import { LoginForm } from './login-form';

describe('LoginForm', () => {
  it('renders updated onboarding-focused copy', () => {
    render(<LoginForm />);

    expect(screen.getByRole('heading', { name: 'Welcome to ICONIC Academy' })).toBeInTheDocument();
    expect(
      screen.getByText(
        /Sign in or get started in seconds. We'll create your secure account automatically if you're new\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send secure link' })).toBeInTheDocument();
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
});
