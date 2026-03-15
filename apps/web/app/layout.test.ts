import { describe, expect, it } from 'vitest';
import { metadata } from './layout.metadata';

describe('root layout metadata', () => {
  it('defines shared favicon and manifest metadata', () => {
    expect(metadata.manifest).toBe('/manifest.webmanifest');
    expect(metadata.icons).toEqual({
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/icon.svg', type: 'image/svg+xml' },
        { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      ],
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
      shortcut: ['/favicon.ico'],
    });
  });
});
