import { MARKETING_FAQS } from './marketing.constants';
import { MARKETING_CARD_CLASS, MARKETING_SECTION_CLASS } from './marketing-layout';

export function MarketingFaqSection() {
  return (
    <section className={MARKETING_SECTION_CLASS}>
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase text-primary">FAQ</p>
          <h2 className="mt-3 text-3xl font-bold tracking-normal">
            Questions families ask before starting online tutoring
          </h2>
          <p className="mt-4 text-foreground/75">
            Clear answers about subjects, curriculum support, scheduling, pricing, and
            parent communication.
          </p>
        </div>
        <div className="grid gap-4">
          {MARKETING_FAQS.map((item) => (
            <article key={item.question} className={MARKETING_CARD_CLASS}>
              <h3 className="text-lg font-semibold">{item.question}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {item.answer}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
