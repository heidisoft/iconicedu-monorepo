import type { Metadata } from 'next';
import { MAIN_MENU_PAGE_CONTENT, MarketingMainMenuPage } from '@iconicedu/ui-web';
import {
  assertMarketingSitePagesEnabled,
  resolveMarketingLoginHref,
} from '../_lib/marketing-site-pages';

export const metadata: Metadata = {
  title: 'About | ICONIC Academy',
  description:
    'Learn about ICONIC Academy’s mission to make trustworthy, warm, affordable online learning available to more families.',
  alternates: { canonical: '/about' },
};

export default async function AboutPage() {
  await assertMarketingSitePagesEnabled();
  const loginHref = await resolveMarketingLoginHref();

  return (
    <MarketingMainMenuPage content={MAIN_MENU_PAGE_CONTENT.about} loginHref={loginHref} />
  );
}
