import type { MarketingInfoPageContent } from './marketing-site-content';

type MarketingInfoPageProps = {
  content: MarketingInfoPageContent;
  loginHref?: string;
};

export function MarketingInfoPage({
  content,
  loginHref = '/iconic-academy/login',
}: MarketingInfoPageProps) {
  return (
    <div className="bg-background text-foreground">
      <section className="border-b border-border/60 bg-emerald-50/60 px-4 py-16 dark:bg-emerald-950/20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
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

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-4xl gap-5">
          {content.sections.map((section) => (
            <article
              key={section.title}
              className="rounded-lg border border-border/70 bg-card px-6 py-5 shadow-sm"
            >
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {section.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-border/60 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
