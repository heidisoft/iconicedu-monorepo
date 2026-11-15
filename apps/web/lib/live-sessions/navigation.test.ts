import { describe, expect, it } from 'vitest';
import { getLiveSessionReturnPath, withLiveSessionReturnPath } from './navigation';

describe('live session return navigation', () => {
  it.each([
    undefined,
    null,
    '',
    'https://evil.invalid',
    '//evil.invalid',
    '/\\evil.invalid',
    '/live/session',
    '/live',
    '/a\nfoo',
  ])('falls back home for unsafe or meeting destinations: %s', (input) => {
    expect(getLiveSessionReturnPath(input)).toBe('/');
  });
  it('preserves the exact source including its channel query and scroll anchor', () => {
    const path = '/academy/messages?channel=class-1#message-2';
    expect(getLiveSessionReturnPath(path)).toBe(path);
    const href = withLiveSessionReturnPath('/live/session?passcode=demo', {
      href: `https://app.invalid${path}`,
      origin: 'https://app.invalid',
    });
    const url = new URL(href, 'https://app.invalid');
    expect(url.searchParams.get('returnTo')).toBe(path);
    expect(url.searchParams.get('passcode')).toBe('demo');
  });
  it('does not modify third-party meetings or unrelated internal routes', () => {
    const source = { href: 'https://app.invalid/academy', origin: 'https://app.invalid' };
    expect(withLiveSessionReturnPath('https://zoom.us/j/123', source)).toBe(
      'https://zoom.us/j/123',
    );
    expect(withLiveSessionReturnPath('/academy/live-sessions/123', source)).toBe(
      '/academy/live-sessions/123',
    );
  });
  it('replaces stale return destinations when joining from a different page', () => {
    const href = withLiveSessionReturnPath('/live/session?returnTo=%2Fold', {
      href: 'https://app.invalid/new',
      origin: 'https://app.invalid',
    });
    expect(new URL(href, 'https://app.invalid').searchParams.get('returnTo')).toBe(
      '/new',
    );
  });
});
