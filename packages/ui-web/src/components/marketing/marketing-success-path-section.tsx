import { SUCCESS_PATH_STEPS } from './marketing.constants';
import {
  MARKETING_CARD_CLASS,
  MARKETING_PANEL_CLASS,
  MARKETING_SECTION_CLASS,
} from './marketing-layout';

export function MarketingSuccessPathSection() {
  return (
    <section className={MARKETING_SECTION_CLASS}>
      <div className={MARKETING_PANEL_CLASS}>
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
            <article key={step.title} className={`${MARKETING_CARD_CLASS} bg-background`}>
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
