import { MarketingHeroHeadline } from './marketing-hero-headline';
import { TRUST_INDICATORS } from './marketing.constants';

export function MarketingHeroSection() {
  return (
    <section
      id="home"
      className="relative min-h-screen overflow-hidden bg-gradient-to-b from-emerald-50/70 via-background to-background px-4 pb-16 pt-0 dark:from-emerald-950/25 dark:via-background dark:to-background"
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        data-testid="hero-background"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(16,185,129,0.18),transparent_38%),radial-gradient(circle_at_82%_14%,rgba(34,197,94,0.14),transparent_36%)] dark:bg-[radial-gradient(circle_at_18%_18%,rgba(16,185,129,0.26),transparent_40%),radial-gradient(circle_at_82%_14%,rgba(34,197,94,0.22),transparent_38%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(16,185,129,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,185,129,0.12)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(circle_at_center,black,transparent_84%)] dark:bg-[linear-gradient(to_right,rgba(16,185,129,0.2)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,185,129,0.2)_1px,transparent_1px)]" />
        <div className="absolute -left-14 top-1/3 h-72 w-72 rounded-full bg-emerald-300/24 blur-3xl dark:bg-emerald-500/22" />
        <div className="absolute -right-14 top-1/4 h-64 w-64 rounded-full bg-lime-300/20 blur-3xl dark:bg-lime-500/18" />
      </div>
      <div className="relative z-10 mx-auto max-w-6xl pt-20">
        <div className="mb-12 text-center">
          <MarketingHeroHeadline />
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
            Personalized learning paths for K-12 students. Help your child gain
            confidence, master new skills, and build a lifelong love of learning at
            their own pace.
          </p>
          <div className="mx-auto max-w-3xl rounded-3xl border border-border/60 bg-background p-8 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:shadow-emerald-950/20 md:p-12">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Start your journey now
              </a>
              <a
                href="/login/tutor"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-background px-8 py-3 text-sm font-semibold text-foreground transition hover:bg-muted dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/35"
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
