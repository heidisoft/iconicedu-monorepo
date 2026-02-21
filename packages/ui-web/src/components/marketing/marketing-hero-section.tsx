import { MarketingHeroHeadline } from './marketing-hero-headline';
import { TRUST_INDICATORS } from './marketing.constants';

export function MarketingHeroSection() {
  return (
    <section id="home" className="relative min-h-screen overflow-hidden bg-background px-4 pb-16 pt-0">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true" data-testid="hero-background">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.18),transparent_40%),radial-gradient(circle_at_80%_10%,hsl(120_60%_70%/0.2),transparent_35%)] dark:bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.24),transparent_45%),radial-gradient(circle_at_80%_10%,hsl(120_50%_45%/0.28),transparent_40%)]" />
        <div className="absolute -left-20 top-1/3 h-56 w-56 rounded-full bg-primary/10 blur-3xl dark:bg-primary/20" />
        <div className="absolute -right-16 top-1/4 h-48 w-48 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-500/20" />
      </div>
      <div className="relative z-10 mx-auto max-w-6xl pt-20">
        <div className="mb-12 text-center">
          <MarketingHeroHeadline />
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
            Personalized learning paths for K-12 students. Help your child gain
            confidence, master new skills, and build a lifelong love of learning at
            their own pace.
          </p>
          <div className="mx-auto max-w-3xl rounded-3xl border border-border/60 bg-background p-8 shadow-sm md:p-12">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Start your journey now
              </a>
              <a
                href="/login/tutor"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-background px-8 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
              >
                Become a Tutor
              </a>
            </div>
            <div className="mt-5 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
              {TRUST_INDICATORS.map((item) => (
                <p key={item.text} className="flex items-center justify-center gap-2">
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
