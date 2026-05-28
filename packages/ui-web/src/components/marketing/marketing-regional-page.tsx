import type { MarketingRegionContent } from './marketing-site-content';
import {
  MARKETING_CARD_CLASS,
  MARKETING_INSET_CARD_CLASS,
  MARKETING_HERO_BAND_CLASS,
  MARKETING_LEAD_CONTAINER_CLASS,
  MARKETING_SECTION_CLASS,
} from './marketing-layout';

type MarketingRegionalPageProps = {
  region: MarketingRegionContent;
  loginHref?: string;
};

export function MarketingRegionalPage({
  region,
  loginHref = '/iconic-academy/get-started',
}: MarketingRegionalPageProps) {
  return (
    <div className="bg-background text-foreground">
      <section className={MARKETING_HERO_BAND_CLASS}>
        <div className={MARKETING_LEAD_CONTAINER_CLASS}>
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

      <section className={MARKETING_SECTION_CLASS}>
        <div className="mx-auto max-w-7xl">
          <h2 className="text-2xl font-semibold">Specialized programs</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {region.programs.map((program) => (
              <article key={program.title} className={MARKETING_CARD_CLASS}>
                <h3 className="text-lg font-semibold">{program.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {program.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${MARKETING_SECTION_CLASS} border-t border-border/60`}>
        <div className="mx-auto max-w-7xl">
          <h2 className="text-2xl font-semibold">Designed for regional growth</h2>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {region.outcomes.map((outcome) => (
              <li key={outcome} className={MARKETING_INSET_CARD_CLASS}>
                {outcome}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
