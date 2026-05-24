import type { Metadata } from 'next';
import { MAIN_MENU_PAGE_CONTENT, MarketingMainMenuPage } from '@iconicedu/ui-web';
import {
  assertMarketingSitePagesEnabled,
  resolveMarketingLoginHref,
} from '../_lib/marketing-site-pages';

export const metadata: Metadata = {
  title: 'Programs | ICONIC Academy',
  description:
    'Explore ICONIC Academy programs, from core academics and test prep to coding, debate, chess, music, art, and future-ready enrichment.',
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
