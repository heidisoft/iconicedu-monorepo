import { describe, expect, it, vi } from 'vitest';
vi.mock('../../../../../ops/mobile-links.json', () => ({
  default: {
    iosApplicationIdentifiers: ['TESTPREFIX.com.example.classroom'],
  },
}));
import { GET } from './route';
describe('Apple association', () => {
  it('publishes public JSON scoped to classroom links', async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      applinks: {
        apps: [],
        details: [{ appID: 'TESTPREFIX.com.example.classroom', paths: ['/live/*'] }],
      },
    });
  });
});
