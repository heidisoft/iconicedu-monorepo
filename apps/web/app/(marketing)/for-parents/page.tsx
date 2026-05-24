import type { Metadata } from 'next';
import {
  MAIN_MENU_PAGE_CONTENT,
  MarketingMainMenuPage,
  MarketingMobileAppSection,
} from '@iconicedu/ui-web';
import {
  assertMarketingSitePagesEnabled,
  resolveMarketingLoginHref,
} from '../_lib/marketing-site-pages';

export const metadata: Metadata = {
  title: 'For Parents | ICONIC Academy',
  description:
    'ICONIC Academy gives parents clear communication, USA and global tutor options, curriculum-aware support, and visibility into student progress.',
  alternates: { canonical: '/for-parents' },
};

export default async function ForParentsPage() {
  await assertMarketingSitePagesEnabled();
  const loginHref = await resolveMarketingLoginHref();

  return (
    <>
      <MarketingMainMenuPage
        content={MAIN_MENU_PAGE_CONTENT.forParents}
        loginHref={loginHref}
      />
      <MarketingMobileAppSection />
    </>
  );
}
