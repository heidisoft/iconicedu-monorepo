import type { MetadataRoute } from 'next';
import { absoluteUrl, getSiteUrl } from '@iconicedu/web/app/(marketing)/seo';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  const isProduction =
    process.env.NODE_ENV === 'production' &&
    !siteUrl.includes('localhost') &&
    !siteUrl.includes('127.0.0.1') &&
    !siteUrl.includes('vercel.app');

  if (!isProduction) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
      sitemap: absoluteUrl('/sitemap.xml'),
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/code',
          '/get-started',
          '/i/get-started',
          '/*/login',
          '/*/admin/',
          '/*/dm/',
          '/*/s/',
          '/*/c/',
          '/*/class-schedule',
          '/*/notifications',
          '/*/live-sessions/',
          '/*/inbox',
        ],
      },
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'PerplexityBot',
          'ClaudeBot',
          'Claude-User',
          'Google-Extended',
          'GoogleOther',
          'Googlebot',
          'Bingbot',
          'BingPreview',
          'Applebot',
          'DuckDuckBot',
          'CCBot',
        ],
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/code',
          '/get-started',
          '/i/get-started',
          '/*/login',
          '/*/admin/',
          '/*/dm/',
          '/*/s/',
          '/*/c/',
          '/*/class-schedule',
          '/*/notifications',
          '/*/live-sessions/',
          '/*/inbox',
        ],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: siteUrl,
  };
}
