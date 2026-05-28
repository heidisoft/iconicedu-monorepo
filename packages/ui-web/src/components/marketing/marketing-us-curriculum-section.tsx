import { US_CURRICULUM_STANDARDS } from './marketing.constants';
import {
  MARKETING_INSET_CARD_CLASS,
  MARKETING_PANEL_CLASS,
  MARKETING_SECTION_CLASS,
} from './marketing-layout';

export function MarketingUsCurriculumSection() {
  return (
    <section id="us-curriculum" className={MARKETING_SECTION_CLASS}>
      <div
        className={`grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start ${MARKETING_PANEL_CLASS}`}
      >
        <div>
          <p className="text-sm font-semibold uppercase text-primary">
            U.S. curriculum support
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-normal">
            Support for students across every U.S. state
          </h2>
          <p className="mt-4 text-foreground/75">
            Whether your child is in New York, New Jersey, Texas, Florida, California, or
            another state, ICONIC Academy can help connect tutoring to classroom
            expectations, homework, grade-level skills, and state standards where
            applicable.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {US_CURRICULUM_STANDARDS.map((standard) => (
            <div key={standard} className={MARKETING_INSET_CARD_CLASS}>
              {standard}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
