import { parsePhoneNumberFromString } from 'libphonenumber-js';

const INVALID_PHONE_MESSAGE =
  'Enter a valid international number (e.g. +1 415 555 0100).';

export function getPhoneValidationError(
  value: string,
  options?: { required?: boolean },
): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return options?.required ? 'Please enter your phone number.' : null;
  }

  const parsed = parsePhoneNumberFromString(trimmed);
  if (!parsed?.isValid()) {
    return INVALID_PHONE_MESSAGE;
  }

  return null;
}
