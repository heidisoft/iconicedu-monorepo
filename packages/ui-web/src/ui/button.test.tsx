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
});
