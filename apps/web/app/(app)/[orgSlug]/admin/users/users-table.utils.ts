export function buildAdminUserDmPath(orgSlug: string, profileId: string): string {
  return `/${orgSlug}/dm?id=${encodeURIComponent(profileId)}`;
}

