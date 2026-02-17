import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Avatar } from '../components/Avatar';

describe('Avatar', () => {
  it('renders initials when no image src', () => {
    render(<Avatar name="John Doe" />);
    expect(screen.getByText('JD')).toBeTruthy();
  });

  it('renders single initial for single name', () => {
    render(<Avatar name="John" />);
    expect(screen.getByText('J')).toBeTruthy();
  });

  it('renders ? when no name provided', () => {
    render(<Avatar />);
    expect(screen.getByText('?')).toBeTruthy();
  });

  it('renders image when src is provided', () => {
    render(<Avatar src="https://example.com/avatar.jpg" name="John" />);
    expect(screen.getByLabelText('John')).toBeTruthy();
  });

  it('handles multi-word names correctly', () => {
    render(<Avatar name="John Michael Doe" />);
    expect(screen.getByText('JD')).toBeTruthy();
  });

  it('renders all size variants', () => {
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
    sizes.forEach((size) => {
      const { unmount } = render(<Avatar name="Test" size={size} />);
      expect(screen.getByText('T')).toBeTruthy();
      unmount();
    });
  });

  it('renders with accessibility label', () => {
    render(<Avatar name="Jane Smith" />);
    expect(screen.getByLabelText('Jane Smith')).toBeTruthy();
  });
});
