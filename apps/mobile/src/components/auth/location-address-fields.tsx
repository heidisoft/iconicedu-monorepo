import React, { useState } from 'react';
import { Text, TextInput, View, type TextStyle, type ViewStyle } from 'react-native';
import { LocationRegionField } from './location-region-field';
import { getCountryAddressFields, getCountryRegions } from '@iconicedu/shared-types';

const ADDRESS_EXAMPLES: Record<
  string,
  { cityPlaceholder?: string; regionPlaceholder?: string }
> = {
  US: {
    cityPlaceholder: 'e.g. New York',
    regionPlaceholder: 'e.g. New York',
  },
  CA: {
    cityPlaceholder: 'e.g. Toronto',
    regionPlaceholder: 'e.g. Ontario',
  },
  GB: {
    cityPlaceholder: 'e.g. London',
    regionPlaceholder: 'e.g. Greater London',
  },
  AU: {
    cityPlaceholder: 'e.g. Sydney',
    regionPlaceholder: 'e.g. New South Wales',
  },
  NZ: {
    cityPlaceholder: 'e.g. Auckland',
    regionPlaceholder: 'e.g. Auckland Region',
  },
  IN: {
    cityPlaceholder: 'e.g. Mumbai',
    regionPlaceholder: 'e.g. Maharashtra',
  },
  LK: {
    cityPlaceholder: 'e.g. Colombo',
    regionPlaceholder: 'e.g. Western Province',
  },
  SG: {
    cityPlaceholder: 'e.g. Orchard',
    regionPlaceholder: 'e.g. Central Region',
  },
  AE: {
    cityPlaceholder: 'e.g. Dubai',
    regionPlaceholder: 'e.g. Dubai',
  },
  DE: {
    cityPlaceholder: 'e.g. Berlin',
    regionPlaceholder: 'e.g. Berlin',
  },
  FR: {
    cityPlaceholder: 'e.g. Paris',
    regionPlaceholder: 'e.g. Île-de-France',
  },
};

type Props = {
  countryCode: string;
  city: string;
  region: string;
  postalCode: string;
  setCity: (value: string) => void;
  setRegion: (value: string) => void;
  setPostalCode: (value: string) => void;
  s: {
    label: TextStyle;
    labelOptional: TextStyle;
    inputWrap: ViewStyle;
    inputWrapFocused: ViewStyle;
    input: TextStyle;
    placeholderColor: string;
  };
};

export function LocationAddressFields({
  countryCode,
  city,
  region,
  postalCode,
  setCity,
  setRegion,
  setPostalCode,
  s,
}: Props) {
  const [focusedField, setFocusedField] = useState<'city' | 'region' | 'postal' | null>(
    null,
  );
  const addressFields =
    getCountryAddressFields(countryCode) ?? getCountryAddressFields('ZZ')!;
  const examples = ADDRESS_EXAMPLES[countryCode];
  return (
    <>
      {addressFields.city.visible && (
        <>
          <Text style={s.label}>
            {addressFields.city.label}
            {!addressFields.city.required && (
              <Text style={s.labelOptional}> (optional)</Text>
            )}
          </Text>
          <View style={[s.inputWrap, focusedField === 'city' && s.inputWrapFocused]}>
            <TextInput
              style={s.input}
              testID="onboarding-city"
              value={city}
              onChangeText={setCity}
              accessibilityLabel={addressFields.city.label}
              placeholder={examples?.cityPlaceholder ?? addressFields.city.label}
              placeholderTextColor={s.placeholderColor}
              autoCapitalize="words"
              returnKeyType="next"
              onFocus={() => setFocusedField('city')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
        </>
      )}
      {addressFields.region.visible && (
        <>
          <Text style={s.label}>
            {addressFields.region.label}
            {!addressFields.region.required && (
              <Text style={s.labelOptional}> (optional)</Text>
            )}
          </Text>
          {getCountryRegions(countryCode).length > 0 ? (
            <LocationRegionField
              countryCode={countryCode}
              value={region}
              label={addressFields.region.label}
              onChange={setRegion}
            />
          ) : (
            <View style={[s.inputWrap, focusedField === 'region' && s.inputWrapFocused]}>
              <TextInput
                style={s.input}
                value={region}
                onChangeText={setRegion}
                accessibilityLabel={addressFields.region.label}
                placeholder={examples?.regionPlaceholder ?? addressFields.region.label}
                placeholderTextColor={s.placeholderColor}
                autoCapitalize="words"
                returnKeyType="next"
                onFocus={() => setFocusedField('region')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          )}
        </>
      )}
      {addressFields.postal.visible && (
        <>
          <Text style={s.label}>
            {addressFields.postal.label}
            {!addressFields.postal.required && (
              <Text style={s.labelOptional}> (optional)</Text>
            )}
          </Text>
          <View style={[s.inputWrap, focusedField === 'postal' && s.inputWrapFocused]}>
            <TextInput
              style={s.input}
              testID="onboarding-postal"
              value={postalCode}
              onChangeText={setPostalCode}
              accessibilityLabel={addressFields.postal.label}
              placeholder={
                addressFields.postal.example
                  ? `e.g. ${addressFields.postal.example}`
                  : addressFields.postal.label
              }
              textContentType="postalCode"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={32}
              placeholderTextColor={s.placeholderColor}
              returnKeyType="done"
              onFocus={() => setFocusedField('postal')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
        </>
      )}
    </>
  );
}
