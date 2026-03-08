import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Chip } from '../components/Chip';
import { UiTrackingContext } from '../lib/tracking-context';

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
    render(<Chip label="Tag" icon={<Text testID="icon">🏷</Text>} />);
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

  describe('analytics tracking', () => {
    it('fires track with label and variant on press', () => {
      const capture = jest.fn();
      render(
        <UiTrackingContext.Provider value={capture}>
          <Chip label="Math" variant="active" onPress={jest.fn()} />
        </UiTrackingContext.Provider>,
      );
      fireEvent.press(screen.getByRole('button'));
      expect(capture).toHaveBeenCalledWith('chip selected', {
        button_name: 'Math',
        component_type: 'chip',
        variant: 'active',
      });
    });

    it('does not fire track when no onPress is provided', () => {
      const capture = jest.fn();
      render(
        <UiTrackingContext.Provider value={capture}>
          <Chip label="Static" />
        </UiTrackingContext.Provider>,
      );
      fireEvent.press(screen.getByRole('button'));
      expect(capture).not.toHaveBeenCalled();
    });
  });
});
