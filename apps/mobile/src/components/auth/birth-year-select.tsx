import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Keyboard, Pressable, StyleSheet, Text } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchableSelectionSheet } from '@iconicedu/ui-native/components/searchable-selection-sheet';
import { useTheme } from '@/providers/theme-provider';

type Props = { disabled?: boolean; value: string; onChange: (value: string) => void };

export function BirthYearSelect({ value, onChange, disabled = false }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setCurrentYear(new Date().getFullYear());
    });
    return () => subscription.remove();
  }, []);
  const options = useMemo(
    () =>
      Array.from({ length: 121 }, (_, index) => {
        const year = String(currentYear - index);
        return { id: year, label: year };
      }),
    [currentYear],
  );

  return (
    <>
      <Pressable
        testID="onboarding-birth-year"
        accessibilityRole="button"
        accessibilityLabel="Year of birth"
        accessibilityValue={{ text: value || 'Select birth year' }}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          setCurrentYear(new Date().getFullYear());
          setOpen(true);
        }}
        style={[
          styles.selector,
          { backgroundColor: colors.inputBg, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.value, { color: value ? colors.text : colors.textMuted }]}>
          {value || 'Select birth year'}
        </Text>
        <ChevronDown size={20} color={colors.textMuted} />
      </Pressable>
      {open && (
        <SearchableSelectionSheet
          visible
          options={options}
          selectedId={value}
          preserveOrder
          colors={colors}
          bottomInset={insets.bottom}
          title="Choose birth year"
          searchPlaceholder="Search year"
          closeLabel="Close birth year picker"
          emptyMessage="No matching years found. Try another year."
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
