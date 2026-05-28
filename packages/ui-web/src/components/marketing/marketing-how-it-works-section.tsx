import { CORE_BENEFITS } from './marketing.constants';
import {
  MARKETING_CARD_CLASS,
  MARKETING_CONTAINER_CLASS,
  MARKETING_PANEL_CLASS,
} from './marketing-layout';

type MarketingHowItWorksSectionProps = {
  loginHref?: string;
};

export function MarketingHowItWorksSection({
  loginHref = '/iconic-academy/get-started',
}: MarketingHowItWorksSectionProps) {
  return (
    <section
      id="how-it-works"
      className={`${MARKETING_CONTAINER_CLASS} pb-12 pt-4 md:pb-16`}
    >
      <div className={MARKETING_PANEL_CLASS}>
        <div className="max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight">
            Why families choose ICONIC Academy
          </h2>
          <p className="mt-3 text-foreground/80">
            ICONIC Academy helps K-12 students succeed in school and beyond with
            experienced tutors, curriculum-aligned support, and enrichment programs
            families can actually afford.
          </p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CORE_BENEFITS.map((benefit) => (
            <article
              key={benefit.title}
              className={`${MARKETING_CARD_CLASS} rounded-2xl border-border/60 bg-background p-5`}
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
              href={loginHref}
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
