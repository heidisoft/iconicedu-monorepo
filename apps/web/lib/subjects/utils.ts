const INVALID_SUBJECT_KEY_CHARS = /[^a-z0-9-]+/g;
const MULTI_HYPHENS = /-{2,}/g;
const EDGE_HYPHENS = /^-+|-+$/g;

export const SUBJECT_KEY_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeSubjectLabel(subject: string) {
  return subject.trim().replace(/\s+/g, ' ');
}

export function normalizeSubjectKey(subject: string) {
  return normalizeSubjectLabel(subject)
    .toLowerCase()
    .replace(INVALID_SUBJECT_KEY_CHARS, '-')
    .replace(MULTI_HYPHENS, '-')
    .replace(EDGE_HYPHENS, '');
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
