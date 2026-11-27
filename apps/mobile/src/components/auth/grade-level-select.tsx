import React, { useMemo, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchableSelectionSheet } from '@iconicedu/ui-native/components/searchable-selection-sheet';
import type { GradeLevel } from '@iconicedu/shared-types';
import { useTheme } from '@/providers/theme-provider';

export type GradeOption = { value: GradeLevel; label: string };
type Props = {
  disabled?: boolean;
  value: string | null;
  onChange: (value: string) => void;
  options: readonly GradeOption[];
};

export function GradeLevelSelect({ value, onChange, options, disabled = false }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const choices = useMemo(
    () => options.map((option) => ({ id: option.value, label: option.label })),
    [options],
  );
  return (
    <>
      <Pressable
        testID="onboarding-grade"
        accessibilityRole="button"
        accessibilityLabel="Grade level"
        accessibilityValue={{ text: selected?.label ?? 'Select grade' }}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
        style={[
          styles.selector,
          { backgroundColor: colors.inputBg, borderColor: colors.border },
        ]}
      >
        <Text
          style={[styles.value, { color: selected ? colors.text : colors.textMuted }]}
        >
          {selected?.label ?? 'Select grade'}
        </Text>
        <ChevronDown size={20} color={colors.textMuted} />
      </Pressable>
      {open && (
        <SearchableSelectionSheet
          visible
          options={choices}
          selectedId={value ?? ''}
          preserveOrder
          colors={colors}
          bottomInset={insets.bottom}
          title="Choose grade level"
          searchPlaceholder="Search grade level"
          closeLabel="Close grade level picker"
          emptyMessage="No grade levels found. Try another grade."
          onClose={() => setOpen(false)}
          onSelect={(option) => {
            onChange(option.id);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
const styles = StyleSheet.create({
  selector: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 16,
  },
  value: { flex: 1, fontSize: 17 },
});
