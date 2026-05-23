import type { Metadata } from 'next';
import { MarketingInfoPage, MARKETING_INFO_PAGES } from '@iconicedu/ui-web';
import {
  assertMarketingSitePagesEnabled,
  resolveMarketingLoginHref,
} from '../_lib/marketing-site-pages';

export const metadata: Metadata = {
  title: 'Terms of Service | ICONIC Academy',
  description:
    'Review the terms for using ICONIC Academy tutoring programs, platform access, and learning services.',
  alternates: { canonical: '/terms' },
};

export default async function TermsPage() {
  await assertMarketingSitePagesEnabled();
  const loginHref = await resolveMarketingLoginHref();

  return <MarketingInfoPage content={MARKETING_INFO_PAGES.terms} loginHref={loginHref} />;
}
