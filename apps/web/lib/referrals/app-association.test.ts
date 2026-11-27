import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ flag: vi.fn() }));
vi.mock('@iconicedu/web/flags', () => ({ enableParentReferrals: mocks.flag }));
import { appleAssociation, androidAssociation } from './app-association';
import { GET as apple } from '@iconicedu/web/app/.well-known/apple-app-site-association/route';
import { GET as android } from '@iconicedu/web/app/.well-known/assetlinks.json/route';
beforeEach(() => {
  mocks.flag.mockResolvedValue(true);
  vi.stubEnv('APPLE_APP_LINKS_TEAM_ID', '');
  vi.stubEnv('ANDROID_APP_LINKS_SHA256', '');
});
afterEach(() => vi.unstubAllEnvs());
it('uses the verified public app identifiers by default', async () => {
  const ios = await (await apple()).json();
  expect(ios.applinks.details[0].appID).toBe('5NVN93C486.com.heidisoft.iconicedu');
  const androidData = await (await android()).json();
  expect(androidData[0].target.sha256_cert_fingerprints).toEqual([
    '39:40:40:8E:E0:FB:2E:A0:3D:03:E6:8B:B7:C7:A3:56:C7:F3:4B:DE:E3:01:08:07:68:E6:D5:69:77:6E:FA:DC',
  ]);
});
it('does not publish malformed override identities', async () => {
  vi.stubEnv('APPLE_APP_LINKS_TEAM_ID', '../invalid');
  vi.stubEnv('ANDROID_APP_LINKS_SHA256', 'not-a-certificate');
  expect(appleAssociation()).toBeNull();
  expect(androidAssociation()).toBeNull();
  expect((await apple()).status).toBe(404);
  expect((await android()).status).toBe(404);
});
it('limits Apple Universal Links to referral paths', async () => {
  vi.stubEnv('APPLE_APP_LINKS_TEAM_ID', 'A1B2C3D4E5');
  expect(await (await apple()).json()).toEqual({
    applinks: {
      apps: [],
      details: [{ appID: 'A1B2C3D4E5.com.heidisoft.iconicedu', paths: ['/r/*'] }],
    },
  });
});
it('publishes only configured Android signing fingerprints and supports certificate rotation', async () => {
  const fingerprint = Array(32).fill('AB').join(':');
  const next = Array(32).fill('CD').join(':');
  vi.stubEnv('ANDROID_APP_LINKS_SHA256', `${fingerprint},${next}`);
  const response = await android();
  expect(response.headers.get('Content-Type')).toContain('application/json');
  expect((await response.json())[0].target).toEqual({
    namespace: 'android_app',
    package_name: 'com.heidisoft.iconicedu',
    sha256_cert_fingerprints: [fingerprint, next],
  });
});
it('gates association endpoints with the referral flag too', async () => {
  vi.stubEnv('APPLE_APP_LINKS_TEAM_ID', 'A1B2C3D4E5');
  mocks.flag.mockResolvedValue(false);
  expect((await apple()).status).toBe(404);
  expect((await android()).status).toBe(404);
});
