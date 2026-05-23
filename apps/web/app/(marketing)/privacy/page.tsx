import type { Metadata } from 'next';
import { MarketingInfoPage, MARKETING_INFO_PAGES } from '@iconicedu/ui-web';
import {
  assertMarketingSitePagesEnabled,
  resolveMarketingLoginHref,
} from '../_lib/marketing-site-pages';

export const metadata: Metadata = {
  title: 'Privacy Policy | ICONIC Academy',
  description:
    'Learn how ICONIC Academy handles personal information for families, learners, educators, and platform visitors.',
  alternates: { canonical: '/privacy' },
};

export default async function PrivacyPage() {
  await assertMarketingSitePagesEnabled();
  const loginHref = await resolveMarketingLoginHref();

  return (
    <MarketingInfoPage content={MARKETING_INFO_PAGES.privacy} loginHref={loginHref} />
  );
}
