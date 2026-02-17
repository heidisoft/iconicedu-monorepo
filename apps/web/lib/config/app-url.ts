const DEFAULT_APP_URL = 'http://localhost:3000';

export function resolveAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL).replace(/\/$/, '');
}

