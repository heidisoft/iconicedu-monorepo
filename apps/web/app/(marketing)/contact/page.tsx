import type { Metadata } from 'next';
import { MarketingContactPage } from '@iconicedu/ui-web';
import { resolveMarketingLoginHref } from '../_lib/marketing-site-pages';
import {
  breadcrumbJsonLd,
  createMarketingMetadata,
  PUBLIC_MARKETING_PAGES,
  webPageJsonLd,
} from '../seo';
import { StructuredData } from '../structured-data';

const pageSeo = PUBLIC_MARKETING_PAGES.find((page) => page.path === '/contact')!;

export const metadata: Metadata = createMarketingMetadata(pageSeo);

export default async function ContactPage() {
  const loginHref = await resolveMarketingLoginHref();

  return (
    <>
      <StructuredData
        data={[
          webPageJsonLd(pageSeo),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Contact', path: '/contact' },
          ]),
        ]}
      />
      <MarketingContactPage loginHref={loginHref} />
    </>
  );
}
