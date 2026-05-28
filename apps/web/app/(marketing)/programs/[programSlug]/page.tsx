import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  MarketingLowFrictionStartSection,
  MARKETING_CARD_CLASS,
  MARKETING_HERO_BAND_CLASS,
  MARKETING_INSET_CARD_CLASS,
  MARKETING_LEAD_CONTAINER_CLASS,
  MARKETING_SECTION_CLASS,
} from '@iconicedu/ui-web';
import {
  assertMarketingSitePagesEnabled,
  resolveMarketingLoginHref,
} from '../../_lib/marketing-site-pages';
import {
  breadcrumbJsonLd,
  courseJsonLd,
  createMarketingMetadata,
  findProgramLandingPage,
  serviceJsonLd,
  webPageJsonLd,
  PROGRAM_LANDING_PAGES,
} from '../../seo';
import { StructuredData } from '../../structured-data';

type ProgramPageProps = {
  params: Promise<{ programSlug: string }>;
};

export function generateStaticParams() {
  return PROGRAM_LANDING_PAGES.map((program) => ({ programSlug: program.slug }));
}

export async function generateMetadata({ params }: ProgramPageProps): Promise<Metadata> {
  const { programSlug } = await params;
  const program = findProgramLandingPage(programSlug);

  if (!program) {
    return createMarketingMetadata({
      path: '/programs',
      title: 'Online Tutoring Programs',
      description: 'Explore ICONIC Academy online tutoring and enrichment programs.',
      priority: 0.5,
      changeFrequency: 'monthly',
    });
  }

  return createMarketingMetadata(program);
}

export default async function ProgramPage({ params }: ProgramPageProps) {
  await assertMarketingSitePagesEnabled();
  const { programSlug } = await params;
  const program = findProgramLandingPage(programSlug);

  if (!program) {
    notFound();
  }

  const loginHref = await resolveMarketingLoginHref();

  return (
    <div className="bg-background text-foreground">
      <StructuredData
        data={[
          webPageJsonLd(program),
          serviceJsonLd(program),
          courseJsonLd(program),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Programs', path: '/programs' },
            { name: program.title, path: program.path },
          ]),
        ]}
      />
      <section className={MARKETING_HERO_BAND_CLASS}>
        <div className={MARKETING_LEAD_CONTAINER_CLASS}>
          <p className="text-sm font-semibold uppercase text-primary">
            Online tutoring program
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-normal sm:text-5xl">
            {program.h1}
          </h1>
          <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
            {program.summary}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href={loginHref}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Find the right tutor
            </a>
            <Link
              href="/programs"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-background px-6 text-sm font-semibold transition hover:bg-muted"
            >
              Explore all programs
            </Link>
          </div>
        </div>
      </section>

      <section className={MARKETING_SECTION_CLASS}>
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-3">
          <article className={MARKETING_CARD_CLASS}>
            <h2 className="text-xl font-semibold">Who this helps</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {program.audience}
            </p>
          </article>
          <article className={`${MARKETING_CARD_CLASS} lg:col-span-2`}>
            <h2 className="text-xl font-semibold">What support can include</h2>
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {program.support.map((item) => (
                <li key={item} className={MARKETING_INSET_CARD_CLASS}>
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>

        <div className="mx-auto mt-8 grid max-w-7xl gap-5 lg:grid-cols-2">
          <article className={MARKETING_CARD_CLASS}>
            <h2 className="text-xl font-semibold">Student outcomes</h2>
            <ul className="mt-4 grid gap-3">
              {program.outcomes.map((item) => (
                <li key={item} className="text-sm leading-6 text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </article>
          <article className={MARKETING_CARD_CLASS}>
            <h2 className="text-xl font-semibold">Related subjects</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {program.relatedSubjects.map((subject) => (
                <span
                  key={subject}
                  className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs text-muted-foreground"
                >
                  {subject}
                </span>
              ))}
            </div>
          </article>
        </div>
      </section>
      <MarketingLowFrictionStartSection loginHref={loginHref} />
    </div>
  );
}
