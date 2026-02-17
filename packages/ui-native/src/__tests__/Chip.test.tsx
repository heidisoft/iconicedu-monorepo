import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Chip } from '../components/Chip';

describe('Chip', () => {
  it('renders label', () => {
    render(<Chip label="Tag" />);
    expect(screen.getByText('Tag')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<Chip label="Filter" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders with icon', () => {
    const { Text } = require('react-native');
    render(
      <Chip label="Tag" icon={<Text testID="icon">🏷</Text>} />,
    );
    expect(screen.getByTestId('icon')).toBeTruthy();
  });

  it('renders all variants', () => {
    const variants = ['default', 'active', 'outline'] as const;
    variants.forEach((variant) => {
      const { unmount } = render(<Chip label="Test" variant={variant} />);
      expect(screen.getByText('Test')).toBeTruthy();
      unmount();
    });
  });

  it('has correct accessibility label', () => {
    render(<Chip label="Category" />);
    expect(screen.getByLabelText('Category')).toBeTruthy();
  });
});
