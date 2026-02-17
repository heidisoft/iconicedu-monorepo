export function resolveSignupDisplayName(input: {
  displayName?: string;
  firstName: string;
  lastName: string;
}): string {
  const displayName = input.displayName?.trim() ?? '';
  if (displayName) {
    return displayName;
  }
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!lastName) {
    return firstName;
  }
  return `${firstName} ${lastName.charAt(0).toUpperCase()}.`;
}
