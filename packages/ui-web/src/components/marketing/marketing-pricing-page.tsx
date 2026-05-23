type MarketingPricingPageProps = {
  loginHref?: string;
};

const PRICING_PATHS = [
  {
    title: 'Global tutor network',
    body: 'Class sessions start from $12/hour with experienced tutors from Sri Lanka, India, and other countries, giving families flexible options across budgets, time zones, and specialties.',
  },
  {
    title: 'Native-speaker subject expertise',
    body: 'For language-heavy subjects like ELA, we match learners with native English speakers from the USA, Australia, and the UK when regional fluency, curriculum familiarity, and accent exposure matter.',
  },
  {
    title: 'Specialty-level matching',
    body: 'Pricing reflects the subject, educator background, learner level, and program intensity, from foundational support to advanced enrichment and competition preparation.',
  },
] as const;

const DIFFERENTIATORS = [
  'Regional educator matching instead of one generic tutor pool',
  'Options for both affordable global tutoring and native-speaker instruction',
  'Support across academics, enrichment, test prep, coding, debate, chess, and STEM',
  'Flexible scheduling for families working across countries and time zones',
  'Parent-visible learning progress and program guidance before long-term commitments',
] as const;

export function MarketingPricingPage({
  loginHref = '/iconic-academy/login',
}: MarketingPricingPageProps) {
  return (
    <div className="bg-background text-foreground">
      <section className="border-b border-border/60 bg-emerald-50/60 px-4 py-16 dark:bg-emerald-950/20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase text-primary">Pricing</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-normal sm:text-5xl">
            Program pricing built around each learner
          </h1>
          <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
            ICONIC Academy pricing depends on program type, educator match, frequency,
            region, and student goals. Class sessions start from $12/hour, with global
            tutor options and native-speaker specialists available for language and
            region-specific learning needs.
          </p>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
          {PRICING_PATHS.map((item) => (
            <article
              key={item.title}
              className="rounded-lg border border-border/70 bg-card px-6 py-5 shadow-sm"
            >
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-8 rounded-lg border border-border/70 bg-card px-6 py-7 shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-semibold uppercase text-primary">
              What makes us different
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              Regional specialization without losing global flexibility
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Many tutoring marketplaces optimize for quick booking. ICONIC Academy
              focuses on fit: the right educator background, the right language exposure,
              the right regional expertise, and the right level of academic challenge for
              each learner.
            </p>
          </div>
          <ul className="grid gap-3">
            {DIFFERENTIATORS.map((item) => (
              <li
                key={item}
                className="rounded-lg border border-border/60 bg-background px-4 py-3 text-sm text-muted-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto mt-10 flex max-w-5xl flex-col gap-4 rounded-lg border border-border/70 bg-card px-6 py-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-semibold">Request program details</p>
            <p className="text-sm text-muted-foreground">
              Sign in or get started so the team can recommend tutor options by budget,
              learner goals, language needs, and regional expertise.
            </p>
          </div>
          <a
            href={loginHref}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Request details
          </a>
        </div>
      </section>
    </div>
  );
}
