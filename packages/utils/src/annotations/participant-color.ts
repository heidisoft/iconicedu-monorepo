/** Deterministic, distinct defaults for the same participant roster in every viewer. */
export function participantColor(id: string, participantIds: readonly string[] = [id]) {
  const palette = [
    '#2563eb',
    '#dc2626',
    '#16a34a',
    '#9333ea',
    '#ea580c',
    '#0891b2',
    '#db2777',
    '#4f46e5',
    '#65a30d',
    '#b45309',
    '#0d9488',
    '#7c3aed',
  ];
  const used = new Set<string>();
  for (const participantId of [...new Set([...participantIds, id])].sort()) {
    let hash = 2166136261;
    for (const char of participantId)
      hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    let candidate = palette[(hash >>> 0) % palette.length];
    if (used.has(candidate)) candidate = palette.find((color) => !used.has(color)) ?? '';
    // Continue with distinct mid-tone RGB colors for meetings larger than the palette.
    let value = hash >>> 0;
    while (!candidate || used.has(candidate)) {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      candidate = `#${[0, 8, 16].map((shift) => (48 + ((value >>> shift) % 144)).toString(16).padStart(2, '0')).join('')}`;
    }
    used.add(candidate);
    if (participantId === id) return candidate;
  }
  return palette[0];
}
