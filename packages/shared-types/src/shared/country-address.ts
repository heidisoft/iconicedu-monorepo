import { COUNTRY_ADDRESS_METADATA } from './country-address-metadata';

export type ProfileLocationInput = {
  countryCode: string;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
};
export type AddressFieldConfig = {
  label: string;
  visible: boolean;
  required: boolean;
  example: string;
};
export type CountryAddressFields = {
  city: AddressFieldConfig;
  region: AddressFieldConfig;
  postal: AddressFieldConfig;
  postalPattern: string | null;
};

const REGION_LABELS: Record<string, string> = {
  state: 'State',
  province: 'Province',
  county: 'County',
  area: 'Area',
  district: 'District',
  prefecture: 'Prefecture',
  island: 'Island',
  department: 'Department',
  emirate: 'Emirate',
  parish: 'Parish',
};
const POSTAL_LABELS: Record<string, string> = {
  postal: 'Postal code',
  zip: 'ZIP code',
  pin: 'PIN code',
  eircode: 'Eircode',
};

export function getCountryAddressFields(
  countryCode: string,
): CountryAddressFields | null {
  const code = countryCode.toUpperCase();
  const data = COUNTRY_ADDRESS_METADATA[code];
  if (!data) return null;
  const field = (token: string, label: string, example = ''): AddressFieldConfig => ({
    label,
    visible: data.format.includes(`%${token}`),
    required: data.required.includes(token),
    example,
  });
  return {
    city: field(
      'C',
      code === 'GB' ? 'City or town' : code === 'AU' ? 'City or suburb' : 'City',
    ),
    region: field(
      'S',
      code === 'AU'
        ? 'State or territory'
        : (REGION_LABELS[data.regionType] ?? 'State / region / province'),
    ),
    postal: field(
      'Z',
      ['GB', 'AU', 'NZ'].includes(code)
        ? 'Postcode'
        : (POSTAL_LABELS[data.postalType] ?? 'Postal code'),
      data.postalExample,
    ),
    postalPattern: data.postalPattern || null,
  };
}

export type LocationSuggestion = {
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
};
