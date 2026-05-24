import type { Metadata } from 'next';
import {
  MARKETING_REGIONS,
  MarketingRegionalPage,
  findMarketingRegion,
} from '@iconicedu/ui-web';
import { notFound } from 'next/navigation';
import {
  assertMarketingSitePagesEnabled,
  resolveMarketingLoginHref,
} from '../../_lib/marketing-site-pages';
import { breadcrumbJsonLd, createMarketingMetadata, webPageJsonLd } from '../../seo';
import { StructuredData } from '../../structured-data';

type RegionalPageProps = {
  params: Promise<{ regionSlug: string }>;
};

export function generateStaticParams() {
  return MARKETING_REGIONS.map((region) => ({ regionSlug: region.slug }));
}

export async function generateMetadata({ params }: RegionalPageProps): Promise<Metadata> {
  const { regionSlug } = await params;
  const region = findMarketingRegion(regionSlug);

  if (!region) {
    return createMarketingMetadata({
      path: '/regions',
      title: 'Regional Programs | ICONIC Academy',
      description: 'Explore ICONIC Academy regional tutoring programs.',
      priority: 0.4,
      changeFrequency: 'monthly',
    });
  }

  return createMarketingMetadata({
    path: `/regions/${region.slug}`,
    title: `${region.regionName} Programs | ICONIC Academy`,
    description: region.description,
    priority: 0.5,
    changeFrequency: 'monthly',
  });
}

export default async function RegionalPage({ params }: RegionalPageProps) {
  await assertMarketingSitePagesEnabled();
  const { regionSlug } = await params;
  const region = findMarketingRegion(regionSlug);

  if (!region) {
    notFound();
  }

  const loginHref = await resolveMarketingLoginHref();

  const pageSeo = {
    path: `/regions/${region.slug}`,
    title: `${region.regionName} Programs`,
    description: region.description,
    priority: 0.5,
    changeFrequency: 'monthly' as const,
  };

  return (
    <>
      <StructuredData
        data={[
          webPageJsonLd(pageSeo),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Regions', path: '/regions/global-online' },
            { name: region.regionName, path: `/regions/${region.slug}` },
          ]),
        ]}
      />
      <MarketingRegionalPage region={region} loginHref={loginHref} />
    </>
  );
}
