export function normalizeSubjectLabel(subject: string) {
  return subject.trim().replace(/\s+/g, ' ');
}

export function normalizeSubjectKey(subject: string) {
  return normalizeSubjectLabel(subject).toLowerCase();
}

export function mergeSubjectOptions(
  subjectOptions: string[],
  extras: Array<string | null | undefined> = [],
) {
  const seen = new Set<string>();
  const merged: string[] = [];

  const push = (value?: string | null) => {
    if (!value) {
      return;
    }
    const normalized = normalizeSubjectLabel(value);
    if (!normalized) {
      return;
    }
    const key = normalizeSubjectKey(normalized);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(normalized);
  };

  subjectOptions.forEach(push);
  extras.forEach(push);

  return merged;
}
