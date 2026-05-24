import { MarketingHeroSubjectTicker } from './marketing-hero-subject-ticker';

export function MarketingHeroHeadline() {
  return (
    <div className="text-center">
      <div className="mb-8">
        <h1 className="text-5xl font-bold tracking-tight md:text-7xl">
          <span className="block text-foreground">It&apos;s time to</span>
          <span className="mt-2 flex flex-wrap items-center justify-center gap-3 md:gap-4">
            <span className="text-foreground">unlock your</span>
            <span className="inline-flex items-center gap-2 rounded-4xl border border-border/60 bg-primary/15 px-4 py-1 text-2xl text-primary dark:border-emerald-900/50 md:text-5xl">
              <span aria-hidden="true">🎓</span>
              <span className="font-semibold text-primary">child&apos;s</span>
            </span>
          </span>
          <span className="mt-2 block">potential in</span>
        </h1>
        <p className="sr-only">
          Personalized K-12 tutoring for school success, confidence, and future-ready
          skills.
        </p>
      </div>

      <div className="mb-12 flex min-h-28 items-center justify-center">
        <MarketingHeroSubjectTicker />
      </div>
    </div>
  );
}
