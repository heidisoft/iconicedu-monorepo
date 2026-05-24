import type { Metadata } from 'next';
import { MAIN_MENU_PAGE_CONTENT, MarketingMainMenuPage } from '@iconicedu/ui-web';
import {
  assertMarketingSitePagesEnabled,
  resolveMarketingLoginHref,
} from '../_lib/marketing-site-pages';

export const metadata: Metadata = {
  title: 'Subjects | ICONIC Academy',
  description:
    'Explore ICONIC Academy subjects, full-curriculum support, state standards support where applicable, enrichment, coding, STEM, debate, and test prep.',
  alternates: { canonical: '/subjects' },
};

export default async function SubjectsPage() {
  await assertMarketingSitePagesEnabled();
  const loginHref = await resolveMarketingLoginHref();

  return (
    <MarketingMainMenuPage
      content={MAIN_MENU_PAGE_CONTENT.subjects}
      loginHref={loginHref}
    />
  );
}
