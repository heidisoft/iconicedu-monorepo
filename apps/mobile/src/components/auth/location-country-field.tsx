import React, { useMemo, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchableSelectionSheet } from '@iconicedu/ui-native/components/searchable-selection-sheet';
import type { AppColors } from '@/lib/theme';

type Props = {
  countries: readonly { code: string; label: string }[];
  countryCode: string;
  onChange: (code: string) => void;
  colors: AppColors;
};

export function LocationCountryField({
  countries,
  countryCode,
  onChange,
  colors,
}: Props) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const options = useMemo(
    () =>
      countries.map((country) => ({
        id: country.code,
        label: country.label,
        searchText: country.code,
      })),
    [countries],
  );
  const selected = options.find((option) => option.id === countryCode);
  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textMuted }]}>Country</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Country: ${selected?.label ?? 'Choose country'}. Change country`}
        accessibilityState={{ expanded: open }}
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
          {selected?.label ?? 'Choose country'}
        </Text>
        <ChevronDown size={20} color={colors.textMuted} />
      </Pressable>
      {open && (
        <SearchableSelectionSheet
          visible
          options={options}
          selectedId={countryCode}
          colors={colors}
          bottomInset={insets.bottom}
          title="Choose country"
          searchPlaceholder="Search country"
          closeLabel="Close country picker"
          emptyMessage="No countries found. Try another country name."
          onClose={() => setOpen(false)}
          onSelect={(option) => {
            onChange(option.id);
            setOpen(false);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, marginBottom: 16 },
  label: { fontSize: 15, fontWeight: '500' },
  selector: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  value: { flex: 1, fontSize: 17 },
});
