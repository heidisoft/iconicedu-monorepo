import { CORE_BENEFITS } from './marketing.constants';

export function MarketingHowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="mx-auto max-w-7xl px-4 pb-12 pt-4 sm:px-6 md:pb-16 lg:px-8"
    >
      <div className="rounded-3xl border border-border/60 bg-card/60 p-6 sm:p-8">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight">
            One platform for students, parents, and educators
          </h2>
          <p className="mt-3 text-foreground/80">
            From first lesson to measurable outcomes, ICONIC Academy helps families stay
            aligned and students stay motivated.
          </p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {CORE_BENEFITS.map((benefit) => (
            <article
              key={benefit.title}
              className="rounded-2xl border border-border/60 bg-background p-5"
            >
              <h3 className="text-lg font-semibold">{benefit.title}</h3>
              <p className="mt-2 text-sm text-foreground/75">{benefit.description}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 rounded-2xl bg-primary/15 p-5 sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Ready to begin?
          </p>
          <p className="mt-2 text-lg font-medium">
            Explore tutors, choose the right fit, and start learning with confidence.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <a
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Explore and sign up
            </a>
            <a
              href="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-background px-6 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              Talk to our team
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
