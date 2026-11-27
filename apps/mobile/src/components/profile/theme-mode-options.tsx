import { SheetContent } from '@iconicedu/ui-native/components/sheet-content';
import React from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Check, ChevronDown, X } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import type { ThemeMode } from '@/lib/theme';

export const MODE_OPTIONS: { value: ThemeMode; label: string; sub: string }[] = [
  { value: 'system', label: 'System', sub: 'Follow device setting' },
  { value: 'light', label: 'Light', sub: 'Always light' },
  { value: 'dark', label: 'Dark', sub: 'Always dark' },
];

/** The existing Preferences theme rows, shared by its picker and section editor. */
export function ThemeModeOptions({
  value,
  onChange,
  disabled = false,
}: {
  value: ThemeMode;
  onChange: (value: ThemeMode) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <>
      {MODE_OPTIONS.map((option, index) => (
        <React.Fragment key={option.value}>
          {index > 0 && (
            <View
              style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 24 }}
            />
          )}
          <TouchableOpacity
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: value === option.value, disabled }}
            disabled={disabled}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 16,
              paddingHorizontal: 24,
              gap: 14,
            }}
            onPress={() => onChange(option.value)}
            activeOpacity={0.7}
          >
            <View style={{ gap: 2, flex: 1 }}>
              <Text
                style={{ flex: 1, fontSize: 17, color: colors.text, fontWeight: '500' }}
              >
                {option.label}
              </Text>
              <Text style={{ fontSize: 14, color: colors.textMuted }}>{option.sub}</Text>
            </View>
            {value === option.value && <Check size={20} color={colors.teal} />}
          </TouchableOpacity>
        </React.Fragment>
      ))}
    </>
  );
}

/** Keep mode selection compact; choices open in the same native sheet as other preferences. */
export function ThemeModePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: ThemeMode;
  onChange: (value: ThemeMode) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = React.useState(false);
  const selected = MODE_OPTIONS.find((option) => option.value === value)!;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Theme: ${selected.label}. Change theme`}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={{
          minHeight: 56,
          padding: 16,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.inputBg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 17 }}>{selected.label}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>{selected.sub}</Text>
        </View>
        <ChevronDown size={20} color={colors.textMuted} />
      </Pressable>
      <Modal
        visible={open}
        presentationStyle="pageSheet"
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <SheetContent backgroundColor={colors.pageBg}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingBottom: 16,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close theme picker"
              onPress={() => setOpen(false)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.inputBg,
              }}
            >
              <X size={22} color={colors.text} />
            </Pressable>
            <Text
              accessibilityRole="header"
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 20,
                fontWeight: '600',
                color: colors.text,
              }}
            >
              Choose theme
            </Text>
            <View style={{ width: 44 }} />
          </View>
          <ThemeModeOptions
            value={value}
            disabled={disabled}
            onChange={(mode) => {
              onChange(mode);
              setOpen(false);
            }}
          />
        </SheetContent>
      </Modal>
    </>
  );
}
