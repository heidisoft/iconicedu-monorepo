import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from '../components/Button';
import { UiTrackingContext } from '../lib/tracking-context';

describe('Button', () => {
  it('renders label text', () => {
    render(<Button label="Click me" />);
    expect(screen.getByText('Click me')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<Button label="Press" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    render(<Button label="Disabled" onPress={onPress} disabled />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows ActivityIndicator when loading', () => {
    render(<Button label="Loading" loading />);
    expect(screen.queryByText('Loading')).toBeNull();
  });

  it('has correct accessibility label', () => {
    render(<Button label="Submit" />);
    expect(screen.getByLabelText('Submit')).toBeTruthy();
  });

  it('sets accessibility state disabled when loading', () => {
    render(<Button label="Loading" loading />);
    const button = screen.getByRole('button');
    expect(button.props.accessibilityState).toEqual({ disabled: true });
  });

  it('renders with different variants', () => {
    const { rerender } = render(<Button label="Primary" variant="primary" />);
    expect(screen.getByText('Primary')).toBeTruthy();

    rerender(<Button label="Ghost" variant="ghost" />);
    expect(screen.getByText('Ghost')).toBeTruthy();

    rerender(<Button label="Destructive" variant="destructive" />);
    expect(screen.getByText('Destructive')).toBeTruthy();
  });

  it('renders with different sizes', () => {
    const { rerender } = render(<Button label="Small" size="sm" />);
    expect(screen.getByText('Small')).toBeTruthy();

    rerender(<Button label="Large" size="lg" />);
    expect(screen.getByText('Large')).toBeTruthy();
  });

  describe('analytics tracking', () => {
    it('fires track with analyticsLabel when provided', () => {
      const capture = jest.fn();
      render(
        <UiTrackingContext.Provider value={capture}>
          <Button analyticsLabel="Send message" />
        </UiTrackingContext.Provider>,
      );
      fireEvent.press(screen.getByRole('button'));
      expect(capture).toHaveBeenCalledWith('button_clicked', { label: 'Send message' });
    });

    it('fires track using label when analyticsLabel is not set', () => {
      const capture = jest.fn();
      render(
        <UiTrackingContext.Provider value={capture}>
          <Button label="Submit" />
        </UiTrackingContext.Provider>,
      );
      fireEvent.press(screen.getByRole('button'));
      expect(capture).toHaveBeenCalledWith('button_clicked', { label: 'Submit' });
    });

    it('does not fire track when neither analyticsLabel nor label is set', () => {
      const capture = jest.fn();
      render(
        <UiTrackingContext.Provider value={capture}>
          <Button>Children only</Button>
        </UiTrackingContext.Provider>,
      );
      fireEvent.press(screen.getByRole('button'));
      expect(capture).not.toHaveBeenCalled();
    });

    it('still calls onPress after tracking', () => {
      const capture = jest.fn();
      const onPress = jest.fn();
      render(
        <UiTrackingContext.Provider value={capture}>
          <Button analyticsLabel="Go" onPress={onPress} />
        </UiTrackingContext.Provider>,
      );
      fireEvent.press(screen.getByRole('button'));
      expect(capture).toHaveBeenCalled();
      expect(onPress).toHaveBeenCalled();
    });
  });
});
