import { describe, expect, it, vi } from 'vitest';
vi.mock('../../../../../ops/mobile-links.json', () => ({
  default: {
    androidPackage: 'com.example.classroom',
    androidCertificateSha256: ['AA:BB'],
  },
}));
import { GET } from './route';
describe('Android association', () => {
  it('publishes only configured signing identities without a redirect', async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(await response.json()).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.example.classroom',
          sha256_cert_fingerprints: ['AA:BB'],
        },
      },
    ]);
  });
});
