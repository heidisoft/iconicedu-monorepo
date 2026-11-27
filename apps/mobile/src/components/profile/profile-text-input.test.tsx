import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { lightColors, darkColors } from '@/lib/theme';
import { ProfileTextInput } from './profile-text-input';
let mockColors = lightColors;
let mockIsDark = false;
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: mockColors, isDark: mockIsDark }),
}));
beforeEach(() => {
  mockColors = lightColors;
  mockIsDark = false;
});
it('shows the themed focus border and preserves caller focus/blur behavior', () => {
  const focus = jest.fn(),
    blur = jest.fn(),
    change = jest.fn();
  render(
    <ProfileTextInput
      accessibilityLabel="First name"
      value="Jane"
      onChangeText={change}
      onFocus={focus}
      onBlur={blur}
      autoCapitalize="words"
      returnKeyType="next"
    />,
  );
  const input = screen.getByLabelText('First name');
  fireEvent(input, 'focus', {});
  expect(input).toHaveStyle({ borderColor: lightColors.teal });
  expect(focus).toHaveBeenCalledTimes(1);
  fireEvent.changeText(input, 'Janet');
  expect(change).toHaveBeenCalledWith('Janet');
  fireEvent(input, 'blur', {});
  expect(input).toHaveStyle({ borderColor: lightColors.border });
  expect(blur).toHaveBeenCalledTimes(1);
  expect(input.props.returnKeyType).toBe('next');
});
it('uses dark theme colors for multiline fields and respects read-only state', () => {
  mockColors = darkColors;
  mockIsDark = true;
  const view = render(
    <ProfileTextInput accessibilityLabel="Bio" multiline value="About me" />,
  );
  const input = screen.getByLabelText('Bio');
  expect(input.props.keyboardAppearance).toBe('dark');
  expect(input).toHaveStyle({
    color: darkColors.text,
    backgroundColor: darkColors.inputBg,
    textAlignVertical: 'top',
  });
  fireEvent(input, 'focus', {});
  view.rerender(
    <ProfileTextInput
      accessibilityLabel="Bio"
      multiline
      value="About me"
      editable={false}
    />,
  );
  expect(screen.getByLabelText('Bio').props.editable).toBe(false);
  expect(screen.getByLabelText('Bio')).toHaveStyle({ borderColor: darkColors.border });
});
