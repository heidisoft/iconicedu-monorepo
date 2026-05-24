import type { Metadata } from 'next';
import { getSiteUrl } from '@iconicedu/web/app/(marketing)/seo';

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: 'ICONIC Academy | Online K-12 Tutoring and Enrichment',
    template: '%s | ICONIC Academy',
  },
  description:
    'ICONIC Academy provides online K-12 tutoring, test prep, homework help, and enrichment programs with experienced tutors, parent communication, flexible scheduling, and affordable options.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/favicon.ico'],
  },
};
