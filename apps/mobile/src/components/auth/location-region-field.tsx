import React, { useMemo, useState } from 'react';
import { Keyboard, Pressable, Text } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchableSelectionSheet } from '@iconicedu/ui-native/components/searchable-selection-sheet';
import { findCountryRegion, getCountryRegions } from '@iconicedu/shared-types';
import { useTheme } from '@/providers/theme-provider';

type Props = {
  disabled?: boolean;
  countryCode: string;
  value: string;
  label: string;
  onChange: (value: string) => void;
};
export function LocationRegionField({
  countryCode,
  value,
  label,
  onChange,
  disabled = false,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const regions = getCountryRegions(countryCode);
  const options = useMemo(
    () =>
      regions.map((region) => ({
        id: region.code,
        label: region.label,
        searchText: region.aliases.join(' '),
      })),
    [regions],
  );
  const selected = findCountryRegion(countryCode, value);
  return (
    <>
      <Pressable
        testID="onboarding-region"
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.label ?? `Choose ${label.toLowerCase()}` }}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: colors.inputBg,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 16,
          minHeight: 56,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 17,
            color: selected ? colors.text : colors.textMuted,
          }}
        >
          {selected?.label ?? `Choose ${label.toLowerCase()}`}
        </Text>
        <ChevronDown size={20} color={colors.textMuted} />
      </Pressable>
      {open && (
        <SearchableSelectionSheet
          visible
          options={options}
          selectedId={selected?.code ?? ''}
          colors={colors}
          bottomInset={insets.bottom}
          title={`Choose ${label.toLowerCase()}`}
          searchPlaceholder={`Search ${label.toLowerCase()}`}
          closeLabel={`Close ${label.toLowerCase()} picker`}
          emptyMessage="No matching regions found. Try another name."
          onClose={() => setOpen(false)}
          onSelect={(option) => {
            onChange(option.label);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
