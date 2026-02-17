import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Input } from '../components/Input';

describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Email" />);
    expect(screen.getByText('Email')).toBeTruthy();
  });

  it('renders without label', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeTruthy();
  });

  it('shows error message', () => {
    render(<Input label="Email" error="Invalid email" />);
    expect(screen.getByText('Invalid email')).toBeTruthy();
  });

  it('shows helper text when no error', () => {
    render(<Input label="Email" helperText="We'll never share your email" />);
    expect(screen.getByText("We'll never share your email")).toBeTruthy();
  });

  it('hides helper text when error is present', () => {
    render(
      <Input
        label="Email"
        error="Required"
        helperText="We'll never share your email"
      />,
    );
    expect(screen.getByText('Required')).toBeTruthy();
    expect(screen.queryByText("We'll never share your email")).toBeNull();
  });

  it('calls onChangeText', () => {
    const onChangeText = jest.fn();
    render(<Input label="Name" onChangeText={onChangeText} />);
    fireEvent.changeText(screen.getByLabelText('Name'), 'John');
    expect(onChangeText).toHaveBeenCalledWith('John');
  });

  it('handles focus and blur', () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    render(<Input label="Name" onFocus={onFocus} onBlur={onBlur} />);
    const input = screen.getByLabelText('Name');
    fireEvent(input, 'focus');
    expect(onFocus).toHaveBeenCalled();
    fireEvent(input, 'blur');
    expect(onBlur).toHaveBeenCalled();
  });
});
