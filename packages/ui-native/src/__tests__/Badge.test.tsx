import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Badge } from '@iconicedu/ui-native/components/Badge';

describe('Badge', () => {
  it('renders count', () => {
    render(<Badge count={5} />);
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('renders label', () => {
    render(<Badge label="New" />);
    expect(screen.getByText('New')).toBeTruthy();
  });

  it('caps count at maxCount', () => {
    render(<Badge count={150} maxCount={99} />);
    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('renders dot variant', () => {
    render(<Badge dot variant="error" />);
    expect(screen.getByLabelText('New notification')).toBeTruthy();
  });

  it('returns null when no count, label, or dot', () => {
    const { toJSON } = render(<Badge />);
    expect(toJSON()).toBeNull();
  });

  it('renders with accessibility label for count', () => {
    render(<Badge count={3} />);
    expect(screen.getByLabelText('3 notifications')).toBeTruthy();
  });

  it('renders all variants', () => {
    const variants = ['default', 'success', 'warning', 'error', 'info'] as const;
    variants.forEach((variant) => {
      const { unmount } = render(<Badge count={1} variant={variant} />);
      expect(screen.getByText('1')).toBeTruthy();
      unmount();
    });
  });
});
