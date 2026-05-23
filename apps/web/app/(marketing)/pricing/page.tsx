import type { Metadata } from 'next';
import { MarketingPricingPage } from '@iconicedu/ui-web';
import {
  assertMarketingSitePagesEnabled,
  resolveMarketingLoginHref,
} from '../_lib/marketing-site-pages';

export const metadata: Metadata = {
  title: 'Pricing | ICONIC Academy',
  description:
    'Explore ICONIC Academy tutoring options starting from $12/hour, with global tutors and native-speaker specialists for regional learning needs.',
  alternates: { canonical: '/pricing' },
};

export default async function PricingPage() {
  await assertMarketingSitePagesEnabled();
  const loginHref = await resolveMarketingLoginHref();

  return <MarketingPricingPage loginHref={loginHref} />;
}
