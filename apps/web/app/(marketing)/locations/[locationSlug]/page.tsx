import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  assertMarketingSitePagesEnabled,
  resolveMarketingLoginHref,
} from '../../_lib/marketing-site-pages';
import {
  breadcrumbJsonLd,
  createMarketingMetadata,
  findLocationLandingPage,
  LOCATION_LANDING_PAGES,
  webPageJsonLd,
} from '../../seo';
import { StructuredData } from '../../structured-data';

type LocationPageProps = {
  params: Promise<{ locationSlug: string }>;
};

export function generateStaticParams() {
  return LOCATION_LANDING_PAGES.map((location) => ({ locationSlug: location.slug }));
}

export async function generateMetadata({ params }: LocationPageProps): Promise<Metadata> {
  const { locationSlug } = await params;
  const location = findLocationLandingPage(locationSlug);

  if (!location) {
    return createMarketingMetadata({
      path: '/locations',
      title: 'Online Tutoring Locations',
      description: 'Explore ICONIC Academy online tutoring coverage for families.',
      priority: 0.4,
      changeFrequency: 'monthly',
    });
  }

  return createMarketingMetadata(location);
}

export default async function LocationPage({ params }: LocationPageProps) {
  await assertMarketingSitePagesEnabled();
  const { locationSlug } = await params;
  const location = findLocationLandingPage(locationSlug);

  if (!location) {
    notFound();
  }

  const loginHref = await resolveMarketingLoginHref();

  return (
    <div className="bg-background text-foreground">
      <StructuredData
        data={[
          webPageJsonLd(location),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Locations', path: '/locations/usa' },
            { name: location.title, path: location.path },
          ]),
        ]}
      />
      <section className="border-b border-border/60 bg-emerald-50/60 px-4 py-16 dark:bg-emerald-950/20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase text-primary">
            Online tutoring location
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-normal sm:text-5xl">
            {location.h1}
          </h1>
          <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
            {location.summary}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href={loginHref}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Find the right tutor
            </a>
            <Link
              href="/programs/us-curriculum-support"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-background px-6 text-sm font-semibold transition hover:bg-muted"
            >
              U.S. curriculum support
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2">
          <article className="rounded-lg border border-border/70 bg-card px-6 py-6 shadow-sm">
            <h2 className="text-xl font-semibold">Curriculum-aware support</h2>
            <ul className="mt-4 grid gap-3">
              {location.standards.map((item) => (
                <li
                  key={item}
                  className="rounded-lg border border-border/60 bg-background px-4 py-3 text-sm leading-6 text-muted-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-lg border border-border/70 bg-card px-6 py-6 shadow-sm">
            <h2 className="text-xl font-semibold">What families can expect</h2>
            <ul className="mt-4 grid gap-3">
              {location.support.map((item) => (
                <li
                  key={item}
                  className="rounded-lg border border-border/60 bg-background px-4 py-3 text-sm leading-6 text-muted-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
}
