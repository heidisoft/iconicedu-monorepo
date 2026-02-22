const INVALID_SLUG_CHARS = /[^a-z0-9-]+/g;
const MULTI_HYPHENS = /-{2,}/g;
const EDGE_HYPHENS = /^-+|-+$/g;

export const ORG_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeOrgSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(INVALID_SLUG_CHARS, '-')
    .replace(MULTI_HYPHENS, '-')
    .replace(EDGE_HYPHENS, '');
}
