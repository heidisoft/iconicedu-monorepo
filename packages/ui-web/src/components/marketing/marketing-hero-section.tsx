import { MarketingHeroHeadline } from './marketing-hero-headline';
import { MarketingHeroPatternBackground } from './marketing-hero-pattern-background';
import { MARKETING_CONTAINER_CLASS } from './marketing-layout';
import { TRUST_INDICATORS } from './marketing.constants';

type MarketingHeroSectionProps = {
  loginHref?: string;
};

export function MarketingHeroSection({
  loginHref = '/iconic-academy/get-started',
}: MarketingHeroSectionProps) {
  return (
    <section
      id="home"
      className="relative overflow-hidden bg-gradient-to-b from-action-subtle/60 via-background to-background pb-16 pt-0"
    >
      <MarketingHeroPatternBackground />
      <div className={`${MARKETING_CONTAINER_CLASS} relative z-10 pt-20`}>
        <div className="mb-12 text-center">
          <MarketingHeroHeadline />
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
            ICONIC Academy connects students with experienced tutors for Math, ELA,
            Science, Reading, Writing, Test Prep, Coding, Debate, Chess, Music, Art, and
            more — with support aligned to U.S. state standards, school goals, and each
            child&apos;s learning pace.
          </p>
          <div className="mx-auto max-w-3xl rounded-3xl border border-transparent bg-action-subtle p-8 shadow-soft md:p-12">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href={loginHref}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-action px-8 py-3 text-sm font-semibold text-action-foreground transition hover:opacity-90"
              >
                Find the right tutor
              </a>
              <a
                href="/programs"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-background px-8 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
              >
                Explore programs
              </a>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
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
