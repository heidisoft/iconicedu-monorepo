export function buildChildDisplayName(firstName: string, lastName: string): string {
  const first = firstName.trim();
  const lastInitial = lastName.trim().charAt(0).toUpperCase();

  if (!first) {
    return '';
  }

  if (!lastInitial) {
    return first;
  }

  return `${first} ${lastInitial}`;
}
