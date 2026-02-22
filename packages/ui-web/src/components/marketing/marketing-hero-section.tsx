import { MarketingHeroHeadline } from './marketing-hero-headline';
import { MarketingHeroPatternBackground } from './marketing-hero-pattern-background';
import { TRUST_INDICATORS } from './marketing.constants';

export function MarketingHeroSection() {
  return (
    <section
      id="home"
      className="relative overflow-hidden bg-gradient-to-b from-emerald-50/70 via-background to-background px-4 pb-16 pt-0 dark:from-emerald-950/25 dark:via-background dark:to-background"
    >
      <MarketingHeroPatternBackground />
      <div className="relative z-10 mx-auto max-w-6xl pt-20">
        <div className="mb-12 text-center">
          <MarketingHeroHeadline />
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
            Personalized learning paths for K-12 students. Help your child gain
            confidence, master new skills, and build a lifelong love of learning at their
            own pace.
          </p>
          <div className="mx-auto max-w-3xl rounded-3xl border border-border/60 bg-primary/25 p-8 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:shadow-emerald-950/20 md:p-12">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Start your journey now
              </a>
              <a
                href="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-background px-8 py-3 text-sm font-semibold text-foreground transition hover:bg-muted dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/35"
              >
                Become a Tutor
              </a>
            </div>
            <div className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
              {TRUST_INDICATORS.map((item) => (
                <p key={item.text} className="flex justify-center gap-2">
                  <span className="font-semibold text-primary">{item.icon}</span>
                  <span>{item.text}</span>
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
