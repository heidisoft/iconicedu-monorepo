import type { MarketingInfoPageContent } from './marketing-site-content';
import {
  MARKETING_CARD_CLASS,
  MARKETING_HERO_BAND_CLASS,
  MARKETING_LEAD_CONTAINER_CLASS,
  MARKETING_SECTION_CLASS,
} from './marketing-layout';

type MarketingInfoPageProps = {
  content: MarketingInfoPageContent;
  loginHref?: string;
};

export function MarketingInfoPage({
  content,
  loginHref = '/iconic-academy/get-started',
}: MarketingInfoPageProps) {
  return (
    <div className="bg-background text-foreground">
      <section className={MARKETING_HERO_BAND_CLASS}>
        <div className={MARKETING_LEAD_CONTAINER_CLASS}>
          <p className="text-sm font-semibold uppercase text-primary">
            {content.eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-normal sm:text-5xl">
            {content.title}
          </h1>
          <p className="mt-5 max-w-3xl text-lg text-muted-foreground">{content.intro}</p>
          <p className="mt-6 text-sm text-foreground/60">{content.updatedLabel}</p>
        </div>
      </section>

      <section className={MARKETING_SECTION_CLASS}>
        <div className="mx-auto grid max-w-7xl gap-5">
          {content.sections.map((section) => (
            <article key={section.title} className={MARKETING_CARD_CLASS}>
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {section.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${MARKETING_SECTION_CLASS} border-t border-border/60`}>
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-semibold">Questions about this page?</p>
            <p className="text-sm text-muted-foreground">
              Contact ICONIC Academy or sign in to reach your learning team.
            </p>
          </div>
          <a
            href={loginHref}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Get started
          </a>
        </div>
      </section>
    </div>
  );
}
