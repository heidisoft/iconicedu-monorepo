import type { Metadata } from 'next';
import { MAIN_MENU_PAGE_CONTENT, MarketingMainMenuPage } from '@iconicedu/ui-web';
import {
  assertMarketingSitePagesEnabled,
  resolveMarketingLoginHref,
} from '../_lib/marketing-site-pages';

export const metadata: Metadata = {
  title: 'How It Works | ICONIC Academy',
  description:
    'See how ICONIC Academy helps families choose online tutoring, small-group classes, parent communication, and flexible learning support.',
  alternates: { canonical: '/how-it-works' },
};

export default async function HowItWorksPage() {
  await assertMarketingSitePagesEnabled();
  const loginHref = await resolveMarketingLoginHref();

  return (
    <MarketingMainMenuPage
      content={MAIN_MENU_PAGE_CONTENT.howItWorks}
      loginHref={loginHref}
    />
  );
}
