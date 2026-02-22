import type { ICountry } from 'country-state-city';

export type ReverseGeocodeAddress = Record<string, string | undefined>;

export type NormalizedLocation = {
  countryCode: string;
  countryName: string | null;
  city: string;
  region: string;
  postalCode: string;
  streetAddress: string | null;
};

export function normalizeReverseGeocodeAddress(
  address: ReverseGeocodeAddress,
  countries: ICountry[],
): NormalizedLocation {
  const countryCode = (address.country_code ?? '').toUpperCase();
  const countryName =
    countries.find((entry) => entry.isoCode === countryCode)?.name ??
    address.country ??
    null;
  const city = address.city ?? address.town ?? address.village ?? address.county ?? '';
  const region = address.state ?? address.region ?? '';
  const postalCode = address.postcode ?? '';
  const streetAddress = [address.house_number, address.road].filter(Boolean).join(' ') || null;

  return {
    countryCode,
    countryName,
    city,
    region,
    postalCode,
    streetAddress,
  };
}

export function isLocationComplete(input: {
  countryCode: string;
  city: string;
  region: string;
  postalCode: string;
}): boolean {
  return Boolean(
    input.countryCode.trim() &&
      input.city.trim() &&
      input.region.trim() &&
      input.postalCode.trim(),
  );
}
