import type { MarketingRegionContent } from './marketing-site-content';

type MarketingRegionalPageProps = {
  region: MarketingRegionContent;
  loginHref?: string;
};

export function MarketingRegionalPage({
  region,
  loginHref = '/iconic-academy/login',
}: MarketingRegionalPageProps) {
  return (
    <div className="bg-background text-foreground">
      <section className="border-b border-border/60 bg-emerald-50/60 px-4 py-16 dark:bg-emerald-950/20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase text-primary">
            {region.regionName} programs
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-normal sm:text-5xl">
            {region.headline}
          </h1>
          <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
            {region.description}
          </p>
          <a
            href={loginHref}
            className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            {region.ctaLabel}
          </a>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-semibold">Specialized programs</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {region.programs.map((program) => (
              <article
                key={program.title}
                className="rounded-lg border border-border/70 bg-card px-6 py-5 shadow-sm"
              >
                <h3 className="text-lg font-semibold">{program.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {program.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border/60 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-semibold">Designed for regional growth</h2>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {region.outcomes.map((outcome) => (
              <li
                key={outcome}
                className="rounded-lg border border-border/70 bg-card px-5 py-4 text-sm text-muted-foreground shadow-sm"
              >
                {outcome}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
