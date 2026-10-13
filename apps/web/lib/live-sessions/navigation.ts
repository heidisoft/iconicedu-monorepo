/** Only app-relative destinations can be used after leaving a meeting. */
export function getLiveSessionReturnPath(value?: string | null): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    Array.from(value).some(
      (character) => character.charCodeAt(0) <= 32 || character === '\\',
    )
  )
    return '/';
  try {
    const url = new URL(value, 'https://app.invalid');
    if (url.origin !== 'https://app.invalid' || /^\/live(?:\/|$)/.test(url.pathname))
      return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

/** Capture the actual join source; shared links deliberately omit returnTo. */
export function withLiveSessionReturnPath(
  joinHref: string,
  location: Pick<Location, 'href' | 'origin'>,
): string {
  const url = new URL(joinHref, location.href);
  if (url.origin !== location.origin || !/^\/live\/[^/]+$/.test(url.pathname))
    return joinHref;
  const source = new URL(location.href);
  url.searchParams.set(
    'returnTo',
    getLiveSessionReturnPath(`${source.pathname}${source.search}${source.hash}`),
  );
  return `${url.pathname}${url.search}${url.hash}`;
}
