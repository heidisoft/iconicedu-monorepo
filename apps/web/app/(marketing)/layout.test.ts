import { metadata } from '@iconicedu/web/app/(marketing)/layout';

describe('marketing layout metadata', () => {
  it('defines SEO metadata for the marketing page', () => {
    expect(metadata.title).toBe('ICONIC Academy | Personalized Online Tutoring for K-12');
    expect(metadata.description).toContain('personalized online tutoring');
    expect(metadata.alternates?.canonical).toBe('/');
    expect(metadata.openGraph?.type).toBe('website');
    expect(metadata.twitter?.card).toBe('summary_large_image');
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });
});
