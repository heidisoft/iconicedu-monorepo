import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

describe('resolveAppUrl', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originalVercelBranchUrl = process.env.VERCEL_BRANCH_URL;
  const originalVercelUrl = process.env.VERCEL_URL;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    process.env.VERCEL_BRANCH_URL = originalVercelBranchUrl;
    process.env.VERCEL_URL = originalVercelUrl;
  });

  it('defaults to localhost when no app url is configured', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_BRANCH_URL;
    delete process.env.VERCEL_URL;

    expect(resolveAppUrl()).toBe('http://localhost:3000');
  });

  it('prefers NEXT_PUBLIC_APP_URL when configured', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.iconicacademy.com';

    expect(resolveAppUrl()).toBe('https://app.iconicacademy.com');
  });

  it('falls back to the branch-specific Vercel url', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_BRANCH_URL = 'iconicedu-web-git-feature-preview.vercel.app';

    expect(resolveAppUrl()).toBe('https://iconicedu-web-git-feature-preview.vercel.app');
  });

  it('falls back to the deployment Vercel url when branch url is unavailable', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_BRANCH_URL;
    process.env.VERCEL_URL = 'iconicedu-web-123.vercel.app';

    expect(resolveAppUrl()).toBe('https://iconicedu-web-123.vercel.app');
  });
});
