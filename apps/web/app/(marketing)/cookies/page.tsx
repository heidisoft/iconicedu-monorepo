import type { Metadata } from 'next';
import { MarketingInfoPage, MARKETING_INFO_PAGES } from '@iconicedu/ui-web';
import {
  assertMarketingSitePagesEnabled,
  resolveMarketingLoginHref,
} from '../_lib/marketing-site-pages';

export const metadata: Metadata = {
  title: 'Cookie Policy | ICONIC Academy',
  description:
    'Understand how ICONIC Academy uses cookies and similar technologies across the website and platform.',
  alternates: { canonical: '/cookies' },
};

export default async function CookiesPage() {
  await assertMarketingSitePagesEnabled();
  const loginHref = await resolveMarketingLoginHref();

  return (
    <MarketingInfoPage content={MARKETING_INFO_PAGES.cookies} loginHref={loginHref} />
  );
}
