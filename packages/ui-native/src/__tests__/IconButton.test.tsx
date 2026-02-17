import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { IconButton } from '../components/IconButton';

describe('IconButton', () => {
  const icon = <Text>✕</Text>;

  it('renders icon', () => {
    render(<IconButton icon={icon} label="Close" />);
    expect(screen.getByText('✕')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<IconButton icon={icon} label="Close" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    render(
      <IconButton icon={icon} label="Close" onPress={onPress} disabled />,
    );
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('has correct accessibility label', () => {
    render(<IconButton icon={icon} label="Close dialog" />);
    expect(screen.getByLabelText('Close dialog')).toBeTruthy();
  });

  it('renders all variants', () => {
    const variants = ['default', 'ghost', 'outline'] as const;
    variants.forEach((variant) => {
      const { unmount } = render(
        <IconButton icon={icon} label="Test" variant={variant} />,
      );
      expect(screen.getByRole('button')).toBeTruthy();
      unmount();
    });
  });
});
