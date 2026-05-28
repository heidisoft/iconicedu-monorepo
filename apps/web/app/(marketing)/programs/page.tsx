import type { Metadata } from 'next';
import {
  MAIN_MENU_PAGE_CONTENT,
  MARKETING_CARD_CLASS,
  MARKETING_CONTAINER_CLASS,
  MarketingMainMenuPage,
} from '@iconicedu/ui-web';
import {
  assertMarketingSitePagesEnabled,
  resolveMarketingLoginHref,
} from '../_lib/marketing-site-pages';
import {
  breadcrumbJsonLd,
  createMarketingMetadata,
  PROGRAM_LANDING_PAGES,
  PUBLIC_MARKETING_PAGES,
  webPageJsonLd,
} from '../seo';
import { StructuredData } from '../structured-data';

const pageSeo = PUBLIC_MARKETING_PAGES.find((page) => page.path === '/programs')!;

export const metadata: Metadata = createMarketingMetadata(pageSeo);

export default async function ProgramsPage() {
  await assertMarketingSitePagesEnabled();
  const loginHref = await resolveMarketingLoginHref();

  return (
    <>
      <StructuredData
        data={[
          webPageJsonLd(pageSeo),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Programs', path: '/programs' },
          ]),
        ]}
      />
      <MarketingMainMenuPage
        content={MAIN_MENU_PAGE_CONTENT.subjects}
        loginHref={loginHref}
        beforeLowFrictionStart={
          <section className={`${MARKETING_CONTAINER_CLASS} pb-4`}>
            <div className={MARKETING_CARD_CLASS}>
              <h2 className="text-2xl font-semibold">Popular tutoring pages</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {PROGRAM_LANDING_PAGES.map((program) => (
                  <a
                    key={program.path}
                    href={program.path}
                    className="rounded-full border border-border/60 bg-background px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground"
                  >
                    {program.title}
                  </a>
                ))}
              </div>
            </div>
          </section>
        }
      />
    </>
  );
}
