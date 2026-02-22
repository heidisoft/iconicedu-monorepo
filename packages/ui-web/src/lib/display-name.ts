export type ProfileNameInfo = {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

const normalize = (value?: string | null) => value?.trim() ?? '';
const firstChar = (value: string) => value.charAt(0).toUpperCase();

export function formatFirstAndLastName(
  firstName?: string | null,
  lastName?: string | null,
): string {
  const first = normalize(firstName);
  const last = normalize(lastName);
  return [first, last].filter(Boolean).join(' ');
}

export function formatFirstAndLastInitial(
  firstName?: string | null,
  lastName?: string | null,
): string {
  const first = normalize(firstName);
  const last = normalize(lastName);
  if (!first && !last) {
    return '';
  }
  if (!first) {
    return last;
  }
  if (!last) {
    return first;
  }
  return `${first} ${firstChar(last)}.`;
}

export function getProfileDisplayName(info?: ProfileNameInfo | null, fallback = 'User'): string {
  if (!info) {
    return fallback;
  }
  const displayName = normalize(info.displayName);
  if (displayName) {
    return displayName;
  }
  const fromNames = formatFirstAndLastInitial(info.firstName, info.lastName);
  if (fromNames) {
    return fromNames;
  }
  return fallback;
}

export function getProfileFullName(info?: ProfileNameInfo | null, fallback = 'User'): string {
  if (!info) {
    return fallback;
  }

  const fullName = formatFirstAndLastName(info.firstName, info.lastName);
  if (fullName) {
    return fullName;
  }

  const displayName = normalize(info.displayName);
  if (displayName) {
    return displayName;
  }

  return fallback;
}
