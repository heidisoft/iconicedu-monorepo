type MarketingMainMenuPageContent = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: readonly {
    title: string;
    body: string;
  }[];
  categoryGroups?: readonly {
    title: string;
    subjects: readonly string[];
  }[];
  highlights?: readonly string[];
  bestFor?: readonly string[];
  closingTitle?: string;
  closingBody?: string;
};

type MarketingMainMenuPageProps = {
  content: MarketingMainMenuPageContent;
  loginHref?: string;
};

export function MarketingMainMenuPage({
  content,
  loginHref = '/iconic-academy/login',
}: MarketingMainMenuPageProps) {
  return (
    <div className="bg-background text-foreground">
      <section className="border-b border-border/60 bg-emerald-50/60 px-4 py-16 dark:bg-emerald-950/20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase text-primary">
            {content.eyebrow}
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-normal sm:text-5xl">
            {content.title}
          </h1>
          <p className="mt-5 max-w-3xl text-lg text-muted-foreground">{content.intro}</p>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
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
        {(content.highlights || content.bestFor) && (
          <div className="mx-auto mt-10 grid max-w-5xl gap-5 lg:grid-cols-2">
            {content.highlights && (
              <article className="rounded-lg border border-border/70 bg-card px-6 py-6 shadow-sm">
                <p className="text-sm font-semibold uppercase text-primary">
                  What families can expect
                </p>
                <ul className="mt-4 grid gap-3">
                  {content.highlights.map((item) => (
                    <li
                      key={item}
                      className="rounded-lg border border-border/60 bg-background px-4 py-3 text-sm leading-6 text-muted-foreground"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            )}
            {content.bestFor && (
              <article className="rounded-lg border border-border/70 bg-card px-6 py-6 shadow-sm">
                <p className="text-sm font-semibold uppercase text-primary">Best for</p>
                <ul className="mt-4 grid gap-3">
                  {content.bestFor.map((item) => (
                    <li
                      key={item}
                      className="rounded-lg border border-border/60 bg-background px-4 py-3 text-sm leading-6 text-muted-foreground"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            )}
          </div>
        )}
        {content.categoryGroups && (
          <div className="mx-auto mt-10 max-w-5xl">
            <p className="text-sm font-semibold uppercase text-primary">
              Program categories
            </p>
            <div className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {content.categoryGroups.map((group) => (
                <article
                  key={group.title}
                  className="rounded-lg border border-border/70 bg-card px-6 py-5 shadow-sm"
                >
                  <h2 className="text-lg font-semibold">{group.title}</h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {group.subjects.map((subject) => (
                      <span
                        key={subject}
                        className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs text-muted-foreground"
                      >
                        {subject}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
        {(content.closingTitle || content.closingBody) && (
          <div className="mx-auto mt-10 max-w-5xl rounded-lg border border-border/70 bg-emerald-50/60 px-6 py-6 dark:bg-emerald-950/20">
            {content.closingTitle && (
              <h2 className="text-2xl font-semibold">{content.closingTitle}</h2>
            )}
            {content.closingBody && (
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                {content.closingBody}
              </p>
            )}
          </div>
        )}
        <div className="mx-auto mt-10 flex max-w-5xl flex-col gap-4 rounded-lg border border-border/70 bg-card px-6 py-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-semibold">Find the right learning path</p>
            <p className="text-sm text-muted-foreground">
              Start with your child’s goals, budget, and schedule so we can recommend the
              right support.
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
