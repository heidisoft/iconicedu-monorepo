/** Next's internal request URL can use localhost even when the browser uses 127.0.0.1. */
export function referralRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get('host');
  if (host && !/[\s/@\\?#]/.test(host)) {
    try {
      return new URL(`${url.protocol}//${host}`).origin;
    } catch {
      // Invalid Host headers cannot widen the allowed origin.
    }
  }
  return url.origin;
}
