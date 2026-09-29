import { Platform } from 'react-native';
import { getAppStoreUrl } from './app-store-links';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

describe('getAppStoreUrl', () => {
  afterEach(() => {
    (Platform as unknown as { OS: string }).OS = 'ios';
  });

  it('defaults to the Play Store listing on Android with no override', () => {
    (Platform as unknown as { OS: string }).OS = 'android';
    expect(getAppStoreUrl(null)).toBe(
      'https://play.google.com/store/apps/details?id=com.heidisoft.iconicedu',
    );
  });

  it('prefers an explicit androidUrl override', () => {
    (Platform as unknown as { OS: string }).OS = 'android';
    expect(getAppStoreUrl({ androidUrl: 'https://example.com/android' })).toBe(
      'https://example.com/android',
    );
  });

  it('defaults to the App Store search page on iOS with no override', () => {
    (Platform as unknown as { OS: string }).OS = 'ios';
    expect(getAppStoreUrl(null)).toBe(
      'https://apps.apple.com/search?term=ICONIC%20Academy',
    );
  });

  it('prefers an explicit iosUrl override', () => {
    (Platform as unknown as { OS: string }).OS = 'ios';
    expect(getAppStoreUrl({ iosUrl: 'https://example.com/ios' })).toBe(
      'https://example.com/ios',
    );
  });

  it('ignores a blank override and falls back to the default', () => {
    (Platform as unknown as { OS: string }).OS = 'ios';
    expect(getAppStoreUrl({ iosUrl: '   ' })).toBe(
      'https://apps.apple.com/search?term=ICONIC%20Academy',
    );
  });
});
