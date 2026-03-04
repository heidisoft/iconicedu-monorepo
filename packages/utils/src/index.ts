export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));

export function groupBy<T, K extends string>(
  rows: T[],
  getKey: (row: T) => K,
): Map<K, T[]> {
  const map = new Map<K, T[]>();
  rows.forEach((row) => {
    const key = getKey(row);
    const bucket = map.get(key) ?? [];
    bucket.push(row);
    map.set(key, bucket);
  });
  return map;
}

export function createEnumNormalizer<T extends string>(allowedValues: readonly T[]) {
  return (raw: string | null | undefined): T | null => {
    if (raw != null && (allowedValues as readonly string[]).includes(raw)) {
      return raw as T;
    }
    return null;
  };
}
