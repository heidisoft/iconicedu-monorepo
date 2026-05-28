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
              href="/programs"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-background px-6 text-sm font-semibold transition hover:bg-muted"
            >
              Explore programs
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-3">
          <article className="rounded-lg border border-border/70 bg-card px-6 py-6 shadow-sm">
            <h2 className="text-xl font-semibold">Who this helps</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {location.audience}
            </p>
          </article>
          <article className="rounded-lg border border-border/70 bg-card px-6 py-6 shadow-sm">
            <h2 className="text-xl font-semibold">Curriculum and exams</h2>
            <ul className="mt-4 grid gap-3">
              {[...location.standards, ...location.exams].map((item) => (
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
            <h2 className="text-xl font-semibold">Common tutoring needs</h2>
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

        {location.relatedLocations?.length ? (
          <div className="mx-auto mt-8 max-w-5xl rounded-lg border border-border/70 bg-card px-6 py-6 shadow-sm">
            <h2 className="text-xl font-semibold">Related locations</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {location.relatedLocations.map((relatedLocation) => (
                <Link
                  key={relatedLocation.href}
                  href={relatedLocation.href}
                  className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted"
                >
                  {relatedLocation.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
