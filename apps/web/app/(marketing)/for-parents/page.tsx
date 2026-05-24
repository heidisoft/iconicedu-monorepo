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
import {
  breadcrumbJsonLd,
  createMarketingMetadata,
  PUBLIC_MARKETING_PAGES,
  webPageJsonLd,
} from '../seo';
import { StructuredData } from '../structured-data';

const pageSeo = PUBLIC_MARKETING_PAGES.find((page) => page.path === '/for-parents')!;

export const metadata: Metadata = createMarketingMetadata(pageSeo);

export default async function ForParentsPage() {
  await assertMarketingSitePagesEnabled();
  const loginHref = await resolveMarketingLoginHref();

  return (
    <>
      <StructuredData
        data={[
          webPageJsonLd(pageSeo),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'For Parents', path: '/for-parents' },
          ]),
        ]}
      />
      <MarketingMainMenuPage
        content={MAIN_MENU_PAGE_CONTENT.forParents}
        loginHref={loginHref}
      />
      <MarketingMobileAppSection />
    </>
  );
}
