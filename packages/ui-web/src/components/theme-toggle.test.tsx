import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ThemeToggle } from './theme-toggle';

const useTheme = vi.fn();

vi.mock('next-themes', () => ({
  useTheme: () => useTheme(),
}));

describe('ThemeToggle', () => {
  it('shows SunMoon icon for system theme', () => {
    useTheme.mockReturnValue({
      theme: 'system',
      setTheme: vi.fn(),
    });

    const { container } = render(<ThemeToggle />);

    expect(
      screen.getByRole('button', { name: 'Toggle theme (current: system)' }),
    ).toBeInTheDocument();
    expect(container.querySelector('.lucide-sun-moon')).toBeInTheDocument();
  });
});
