import type { Metadata } from 'next';
import { MarketingHomePage } from '@iconicedu/ui-web';
import { resolveDefaultOrgLoginPath } from '@iconicedu/web/lib/org/resolve-auth-path';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import {
  breadcrumbJsonLd,
  createMarketingMetadata,
  faqJsonLd,
  PUBLIC_MARKETING_PAGES,
  webPageJsonLd,
} from './seo';
import { StructuredData } from './structured-data';

const homeSeo = PUBLIC_MARKETING_PAGES[0];

export const metadata: Metadata = createMarketingMetadata(homeSeo);

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const loginHref = await resolveDefaultOrgLoginPath(supabase);

  return (
    <>
      <StructuredData
        data={[
          webPageJsonLd(homeSeo),
          faqJsonLd(),
          breadcrumbJsonLd([{ name: 'Home', path: '/' }]),
        ]}
      />
      <MarketingHomePage loginHref={loginHref} />
    </>
  );
}
