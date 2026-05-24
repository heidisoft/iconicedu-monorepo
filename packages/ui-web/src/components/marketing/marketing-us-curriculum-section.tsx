import { US_CURRICULUM_STANDARDS } from './marketing.constants';

export function MarketingUsCurriculumSection() {
  return (
    <section id="us-curriculum" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-8 rounded-3xl border border-border/60 bg-card/60 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
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
            <div
              key={standard}
              className="rounded-lg border border-border/60 bg-background px-4 py-3 text-sm leading-6 text-muted-foreground"
            >
              {standard}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
