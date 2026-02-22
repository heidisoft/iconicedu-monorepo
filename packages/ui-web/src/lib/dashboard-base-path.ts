export function resolveDashboardBasePathFromPathname(pathname?: string | null): string {
  const firstSegment = pathname?.split('/').filter(Boolean)[0];
  if (!firstSegment) {
    return '/';
  }
  return `/${firstSegment}`;
}

export function resolveDashboardBasePathFromWindow(): string {
  if (typeof window === 'undefined') {
    return '/';
  }
  return resolveDashboardBasePathFromPathname(window.location.pathname);
}
