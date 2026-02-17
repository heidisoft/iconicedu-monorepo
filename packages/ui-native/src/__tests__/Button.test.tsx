import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from '../components/Button';

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
});
