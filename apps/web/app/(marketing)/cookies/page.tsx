import type { Metadata } from 'next';
import { MarketingInfoPage, MARKETING_INFO_PAGES } from '@iconicedu/ui-web';
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

const pageSeo = PUBLIC_MARKETING_PAGES.find((page) => page.path === '/cookies')!;

export const metadata: Metadata = createMarketingMetadata(pageSeo);

export default async function CookiesPage() {
  await assertMarketingSitePagesEnabled();
  const loginHref = await resolveMarketingLoginHref();

  return (
    <>
      <StructuredData
        data={[
          webPageJsonLd(pageSeo),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Cookie Policy', path: '/cookies' },
          ]),
        ]}
      />
      <MarketingInfoPage content={MARKETING_INFO_PAGES.cookies} loginHref={loginHref} />
    </>
  );
}
