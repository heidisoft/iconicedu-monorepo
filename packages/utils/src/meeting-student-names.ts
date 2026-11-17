/** A readable label for students sharing one meeting connection, within the SDK limit. */
export function formatMeetingStudentNames(names: readonly string[]): string {
  const clean = names.map((name) => name.trim()).filter(Boolean);
  const join = (values: string[]) =>
    values.length < 3
      ? values.join(' & ')
      : `${values.slice(0, -1).join(', ')} & ${values[values.length - 1]}`;
  const full = join(clean);
  if (full.length <= 80) return full;
  const separators = join(clean.map(() => '')).length;
  const limit = Math.max(2, Math.floor((80 - separators) / clean.length));
  return join(
    clean.map((name) =>
      name.length > limit ? `${name.slice(0, limit - 1).trimEnd()}…` : name,
    ),
  );
}
