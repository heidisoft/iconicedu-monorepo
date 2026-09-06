import React from 'react';
import { render, screen } from '@testing-library/react';

import { Button } from './button';

describe('Button', () => {
  it('uses pointer cursor for interactive buttons', () => {
    render(<Button>Click me</Button>);

    expect(screen.getByRole('button', { name: 'Click me' })).toHaveClass(
      'cursor-pointer',
    );
  });

  it('ignores local color utilities while preserving layout overrides', () => {
    render(
      <Button className="h-12 bg-red-500 text-blue-500 border-emerald-500">
        Continue
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Continue' });
    expect(button).toHaveClass('h-12', 'bg-action', 'text-action-foreground');
    expect(button).not.toHaveClass('bg-red-500', 'text-blue-500', 'border-emerald-500');
  });

  it('uses the ink token for secondary emphasis', () => {
    render(<Button variant="secondary">Not now</Button>);

    expect(screen.getByRole('button', { name: 'Not now' })).toHaveClass(
      'bg-ink',
      'text-ink-foreground',
    );
  });

  it('uses the destructive tokens for destructive actions', () => {
    render(<Button variant="destructive">Delete</Button>);

    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass(
      'bg-destructive',
      'text-destructive-foreground',
    );
  });
});
