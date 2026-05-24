import { SUCCESS_PATH_STEPS } from './marketing.constants';

export function MarketingSuccessPathSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-border/60 bg-card/60 p-6 sm:p-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase text-primary">Path to success</p>
          <h2 className="mt-3 text-3xl font-bold tracking-normal">
            A clear path for your child&apos;s success
          </h2>
          <p className="mt-4 text-foreground/75">
            The strongest tutoring is individualized, relationship-based,
            curriculum-connected, and informed by what students need next.
          </p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {SUCCESS_PATH_STEPS.map((step, index) => (
            <article
              key={step.title}
              className="rounded-lg border border-border/70 bg-background px-5 py-5 shadow-sm"
            >
              <p className="text-sm font-semibold text-primary">{index + 1}</p>
              <h3 className="mt-2 text-base font-semibold">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
