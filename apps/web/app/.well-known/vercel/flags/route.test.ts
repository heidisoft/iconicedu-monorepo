import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GET } from './route';

const originalFlagsSecret = process.env.FLAGS_SECRET;

describe('GET /.well-known/vercel/flags', () => {
  beforeEach(() => {
    process.env.FLAGS_SECRET = '12345678901234567890123456789012-base64url';
  });

  afterEach(() => {
    process.env.FLAGS_SECRET = originalFlagsSecret;
  });

  it('requires discovery endpoint authorization', async () => {
    const response = await GET(new Request('http://localhost/.well-known/vercel/flags') as never);

    expect(response.status).toBe(401);
  });
});
