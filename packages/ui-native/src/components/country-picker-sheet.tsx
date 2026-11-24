import React, { useMemo } from 'react';
import { SearchableSelectionSheet } from './searchable-selection-sheet';
import type { ComponentProps } from 'react';

export type CallingCountry = { code: string; label: string; dialCode: string };
type Props = Pick<
  ComponentProps<typeof SearchableSelectionSheet>,
  'visible' | 'bottomInset' | 'colors' | 'onClose'
> & {
  countries: readonly CallingCountry[];
  selectedCode: string;
  onSelect: (country: CallingCountry) => void;
};

export function CountryPickerSheet({
  countries,
  selectedCode,
  onSelect,
  ...props
}: Props) {
  const options = useMemo(
    () =>
      countries.map((country) => ({
        id: country.code,
        label: country.label,
        detail: `+${country.dialCode}`,
        searchText: country.code,
      })),
    [countries],
  );
  return (
    <SearchableSelectionSheet
      {...props}
      options={options}
      selectedId={selectedCode}
      title="Choose country"
      searchPlaceholder="Search country or calling code"
      closeLabel="Close country picker"
      emptyMessage="No countries found. Try a country name or calling code."
      onSelect={(option) => {
        const country = countries.find((item) => item.code === option.id);
        if (country) onSelect(country);
      }}
    />
  );
}
