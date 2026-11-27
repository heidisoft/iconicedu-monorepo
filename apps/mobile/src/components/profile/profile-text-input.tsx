import React, { forwardRef, useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import type { AppColors } from '@/lib/theme';
import { useTheme } from '@/providers/theme-provider';

/** Match onboarding fields throughout profile creation and editing. */
export const profileFieldStyles = (colors: AppColors) => ({
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '500' as const },
  input: {
    color: colors.text,
    backgroundColor: colors.inputBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 56,
    fontSize: 16,
    fontWeight: '400' as const,
    fontStyle: 'normal' as const,
    letterSpacing: 0,
    lineHeight: 22,
    includeFontPadding: false,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16,
    gap: 18,
  },
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48, gap: 12 },
  selector: {
    backgroundColor: colors.inputBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    minHeight: 56,
  },
});

export const ProfileTextInput = forwardRef<TextInput, TextInputProps>(
  function ProfileTextInput(
    { style, onFocus, onBlur, editable = true, multiline, ...props },
    ref,
  ) {
    const { colors, isDark } = useTheme();
    const [focused, setFocused] = useState(false);
    return (
      <TextInput
        {...props}
        ref={ref}
        editable={editable}
        multiline={multiline}
        keyboardAppearance={props.keyboardAppearance ?? (isDark ? 'dark' : 'light')}
        placeholderTextColor={props.placeholderTextColor ?? colors.textFaint}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          profileFieldStyles(colors).input,
          multiline && { minHeight: 140, textAlignVertical: 'top' },
          style,
          focused && editable && { borderColor: colors.teal },
          !editable && { opacity: 0.6 },
        ]}
      />
    );
  },
);
