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
    return {
      title: 'Regional Programs | ICONIC Academy',
      description: 'Explore ICONIC Academy regional tutoring programs.',
    };
  }

  return {
    title: `${region.regionName} Programs | ICONIC Academy`,
    description: region.description,
    alternates: { canonical: `/regions/${region.slug}` },
  };
}

export default async function RegionalPage({ params }: RegionalPageProps) {
  await assertMarketingSitePagesEnabled();
  const { regionSlug } = await params;
  const region = findMarketingRegion(regionSlug);

  if (!region) {
    notFound();
  }

  const loginHref = await resolveMarketingLoginHref();

  return <MarketingRegionalPage region={region} loginHref={loginHref} />;
}
