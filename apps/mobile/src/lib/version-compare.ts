/** Parses a "1.2.3"-style version string into numeric parts, treating missing/non-numeric segments as 0. */
function parseVersionParts(version: string): number[] {
  return version
    .trim()
    .split('.')
    .map((part) => {
      const parsed = Number.parseInt(part, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });
}

/** True when `current` is greater than or equal to `minimum` (dotted numeric versions, any length). */
export function isVersionAtLeast(current: string, minimum: string): boolean {
  const currentParts = parseVersionParts(current);
  const minimumParts = parseVersionParts(minimum);
  const length = Math.max(currentParts.length, minimumParts.length);

  for (let index = 0; index < length; index += 1) {
    const currentPart = currentParts[index] ?? 0;
    const minimumPart = minimumParts[index] ?? 0;
    if (currentPart !== minimumPart) {
      return currentPart > minimumPart;
    }
  }
  return true;
}
