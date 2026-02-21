import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

describe('resolveAppUrl', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it('defaults to localhost when no app url is configured', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(resolveAppUrl()).toBe('http://localhost:3000');
  });

  it('ignores non-local NEXT_PUBLIC_APP_URL outside production', () => {
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.iconicacademy.com';

    expect(resolveAppUrl()).toBe('http://localhost:3000');
  });

  it('allows localhost NEXT_PUBLIC_APP_URL outside production', () => {
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3001/';

    expect(resolveAppUrl()).toBe('http://localhost:3001');
  });

  it('uses configured app url in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.iconicacademy.com/';

    expect(resolveAppUrl()).toBe('https://app.iconicacademy.com');
  });
});
