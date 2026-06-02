import { getScreenName } from './screen-name';

describe('getScreenName', () => {
  describe('static routes', () => {
    it.each([
      ['/', 'Home'],
      ['/(auth)/login', 'Login'],
      ['/(auth)/otp', 'OTP Verification'],
      ['/(auth)/profile-setup', 'Profile Setup'],
      ['/(app)/(tabs)', 'Home'],
      ['/(app)/(tabs)/index', 'Home'],
      ['/(app)/(tabs)/inbox', 'Notifications'],
      ['/(app)/(tabs)/messages', 'Messages'],
      ['/(app)/(tabs)/account', 'Account'],
      ['/(app)/profile', 'Profile'],
      ['/(app)/spaces', 'Spaces'],
      ['/(app)/settings/family', 'Family'],
      ['/(app)/settings/account-info', 'Account Info'],
      ['/(app)/settings/notifications', 'Notifications'],
      ['/(app)/settings/profile', 'Profile Settings'],
      ['/(app)/settings/preferences', 'Preferences'],
      ['/(app)/settings/location', 'Location Settings'],
      ['/(app)/settings/privacy-data', 'Privacy & Data'],
    ])('maps %s → %s', (path, expected) => {
      expect(getScreenName(path)).toBe(expected);
    });
  });

  describe('dynamic routes', () => {
    it('maps spaces/[channelId] paths to "Space"', () => {
      expect(getScreenName('/(app)/spaces/abc-123')).toBe('Space');
      expect(getScreenName('/spaces/xyz')).toBe('Space');
    });

    it('maps channel/[channelId] paths to "Channel"', () => {
      expect(getScreenName('/(app)/channel/abc-123')).toBe('Channel');
      expect(getScreenName('/channel/xyz')).toBe('Channel');
    });

    it('maps dm/[channelId] paths to "Direct Message"', () => {
      expect(getScreenName('/(app)/dm/abc-123')).toBe('Direct Message');
      expect(getScreenName('/dm/xyz')).toBe('Direct Message');
    });
  });

  describe('generic fallback', () => {
    it('formats unknown single-segment paths as title case', () => {
      expect(getScreenName('/dashboard')).toBe('Dashboard');
    });

    it('formats unknown paths with hyphens', () => {
      expect(getScreenName('/my-profile')).toBe('My Profile');
    });

    it('strips route groups from unknown paths', () => {
      expect(getScreenName('/(app)/unknown-screen')).toBe('Unknown Screen');
    });

    it('returns Home for empty or root-only paths after stripping', () => {
      expect(getScreenName('/(app)')).toBe('Home');
    });
  });
});
