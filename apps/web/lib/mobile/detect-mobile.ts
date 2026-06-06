import { userAgent } from 'next/server';
import type { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers';

/**
 * Returns true when the request originates from a mobile or tablet device.
 * Bots are excluded — they should never see the mobile app prompt.
 *
 * Uses Next.js's built-in userAgent helper (backed by ua-parser-js) for
 * structured device.type detection instead of a hand-maintained regex.
 */
export function isMobileOrTablet(requestHeaders: ReadonlyHeaders | Headers): boolean {
  const { device, isBot } = userAgent({ headers: requestHeaders });
  if (isBot) return false;
  return device.type === 'mobile' || device.type === 'tablet';
}
