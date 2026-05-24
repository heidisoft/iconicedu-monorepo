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
    'Tutoring that keeps parents informed with session updates, school-aligned support, flexible schedules, and affordable USA-based or global tutor options.',
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
