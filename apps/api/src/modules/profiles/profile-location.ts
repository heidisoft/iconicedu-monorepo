import { BadRequestException } from '@nestjs/common';
import {
  getCountryAddressFields,
  getCountryRegions,
  findCountryRegion,
  type ProfileLocationInput,
} from '@iconicedu/shared-types';

export function profileLocationError(input: ProfileLocationInput): string | null {
  const config = getCountryAddressFields(input.countryCode);
  if (!config || input.countryCode === 'ZZ') return 'Please select a valid country.';
  for (const [key, field] of [
    ['city', config.city],
    ['region', config.region],
    ['postalCode', config.postal],
  ] as const) {
    if (field.visible && field.required && !input[key]?.trim())
      return `Please enter your ${field.label.toLowerCase()}.`;
  }
  if (
    config.region.visible &&
    input.region?.trim() &&
    getCountryRegions(input.countryCode).length &&
    !findCountryRegion(input.countryCode, input.region)
  ) {
    return `Please select a valid ${config.region.label.toLowerCase()}.`;
  }
  const postal = input.postalCode?.trim().toUpperCase();
  if (
    config.postal.visible &&
    postal &&
    (postal.length > 32 ||
      (config.postalPattern &&
        !new RegExp(`^(?:${config.postalPattern})$`, 'i').test(postal)))
  ) {
    return `Enter a valid ${config.postal.label.toLowerCase()}${config.postal.example ? `, for example ${config.postal.example}` : ''}.`;
  }
  return null;
}

export function normalizeProfileLocation(input: ProfileLocationInput) {
  const error = profileLocationError(input);
  if (error) throw new BadRequestException(error);
  const config = getCountryAddressFields(input.countryCode)!;
  return {
    country_code: input.countryCode.toUpperCase(),
    city: config.city.visible ? input.city?.trim() || null : null,
    region: config.region.visible
      ? (findCountryRegion(input.countryCode, input.region ?? '')?.label ??
          input.region?.trim()) ||
        null
      : null,
    postal_code: config.postal.visible
      ? input.postalCode?.trim().toUpperCase() || null
      : null,
  };
}
