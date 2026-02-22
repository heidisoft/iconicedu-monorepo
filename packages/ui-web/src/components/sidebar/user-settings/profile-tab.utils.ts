import { formatFirstAndLastInitial } from '@iconicedu/ui-web/lib/display-name';

type ResolveProfileDisplayNameInput = {
  firstName: string;
  lastName: string;
  displayName: string;
  isOnboarding: boolean;
};

export function resolveProfileDisplayNameForSave(
  input: ResolveProfileDisplayNameInput,
): string {
  const trimmedFirstName = input.firstName.trim();
  const trimmedLastName = input.lastName.trim();
  const trimmedDisplayName = input.displayName.trim();

  if (input.isOnboarding) {
    const withPeriod = formatFirstAndLastInitial(trimmedFirstName, trimmedLastName);
    return withPeriod.endsWith('.') ? withPeriod.slice(0, -1) : withPeriod;
  }

  if (trimmedDisplayName) {
    return trimmedDisplayName;
  }

  return `${trimmedFirstName} ${trimmedLastName}`.trim();
}
