import type { Metadata } from 'next';
import { MarketingPricingPage } from '@iconicedu/ui-web';
import {
  assertMarketingSitePagesEnabled,
  resolveMarketingLoginHref,
} from '../_lib/marketing-site-pages';

export const metadata: Metadata = {
  title: 'Pricing | ICONIC Academy',
  description:
    'Explore flexible ICONIC Academy tutoring plans, including global tutor support from $12/hour, USA curriculum options, enrichment programs, and custom learning paths.',
  alternates: { canonical: '/pricing' },
};

export default async function PricingPage() {
  await assertMarketingSitePagesEnabled();
  const loginHref = await resolveMarketingLoginHref();

  return <MarketingPricingPage loginHref={loginHref} />;
}
