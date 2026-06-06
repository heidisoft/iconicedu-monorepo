import { describe, expect, it } from 'vitest';

import { isMobileOrTablet } from './detect-mobile';

function headers(ua: string): Headers {
  return new Headers({ 'user-agent': ua });
}

const UA = {
  iPhone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  androidPhone:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36',
  iPad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  androidTablet:
    'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Safari/537.36',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  desktopMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  desktopFirefox:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/120.0',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  empty: '',
} as const;

describe('isMobileOrTablet', () => {
  describe('mobile phones', () => {
    it('detects iPhone', () => {
      expect(isMobileOrTablet(headers(UA.iPhone))).toBe(true);
    });

    it('detects Android phone', () => {
      expect(isMobileOrTablet(headers(UA.androidPhone))).toBe(true);
    });
  });

  describe('tablets', () => {
    it('detects iPad', () => {
      expect(isMobileOrTablet(headers(UA.iPad))).toBe(true);
    });

    it('detects Android tablet', () => {
      expect(isMobileOrTablet(headers(UA.androidTablet))).toBe(true);
    });
  });

  describe('desktop browsers', () => {
    it('rejects Chrome on Windows', () => {
      expect(isMobileOrTablet(headers(UA.desktopChrome))).toBe(false);
    });

    it('rejects Chrome on Mac', () => {
      expect(isMobileOrTablet(headers(UA.desktopMac))).toBe(false);
    });

    it('rejects Firefox on Mac', () => {
      expect(isMobileOrTablet(headers(UA.desktopFirefox))).toBe(false);
    });
  });

  describe('bots', () => {
    it('rejects Googlebot', () => {
      expect(isMobileOrTablet(headers(UA.googlebot))).toBe(false);
    });

    it('rejects Bingbot', () => {
      expect(isMobileOrTablet(headers(UA.bingbot))).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false for empty user-agent', () => {
      expect(isMobileOrTablet(headers(UA.empty))).toBe(false);
    });

    it('returns false when user-agent header is absent', () => {
      expect(isMobileOrTablet(new Headers())).toBe(false);
    });
  });
});
