import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { IconButton } from '@iconicedu/ui-native/components/IconButton';
import { UiTrackingContext } from '@iconicedu/ui-native/lib/tracking-context';

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
    render(<IconButton icon={icon} label="Close" onPress={onPress} disabled />);
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

  describe('analytics tracking', () => {
    it('fires track with label on press', () => {
      const capture = jest.fn();
      render(
        <UiTrackingContext.Provider value={capture}>
          <IconButton icon={icon} label="Close" />
        </UiTrackingContext.Provider>,
      );
      fireEvent.press(screen.getByRole('button'));
      expect(capture).toHaveBeenCalledWith('button clicked', {
        button_name: 'Close',
        component_type: 'icon_button',
      });
    });

    it('still calls onPress after tracking', () => {
      const capture = jest.fn();
      const onPress = jest.fn();
      render(
        <UiTrackingContext.Provider value={capture}>
          <IconButton icon={icon} label="Close" onPress={onPress} />
        </UiTrackingContext.Provider>,
      );
      fireEvent.press(screen.getByRole('button'));
      expect(capture).toHaveBeenCalledWith('button clicked', {
        button_name: 'Close',
        component_type: 'icon_button',
      });
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('does not fire track when disabled', () => {
      const capture = jest.fn();
      render(
        <UiTrackingContext.Provider value={capture}>
          <IconButton icon={icon} label="Close" disabled />
        </UiTrackingContext.Provider>,
      );
      fireEvent.press(screen.getByRole('button'));
      expect(capture).not.toHaveBeenCalled();
    });

    it('uses noop when no provider is present', () => {
      const onPress = jest.fn();
      // Should not throw even without a UiTrackingContext.Provider
      expect(() => {
        render(<IconButton icon={icon} label="Close" onPress={onPress} />);
        fireEvent.press(screen.getByRole('button'));
      }).not.toThrow();
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });
});
