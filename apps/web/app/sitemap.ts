import type { MetadataRoute } from 'next';
import { absoluteUrl, allPublicSeoPages } from '@iconicedu/web/app/(marketing)/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return allPublicSeoPages().map((page) => ({
    url: absoluteUrl(page.path),
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
