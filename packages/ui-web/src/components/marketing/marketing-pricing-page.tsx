import { MarketingLowFrictionStartSection } from './marketing-low-friction-start-section';
import {
  MARKETING_CARD_CLASS,
  MARKETING_ACTION_CARD_CLASS,
  MARKETING_HERO_BAND_CLASS,
  MARKETING_INSET_CARD_CLASS,
  MARKETING_LEAD_CONTAINER_CLASS,
  MARKETING_SECTION_CLASS,
} from './marketing-layout';

type MarketingPricingPageProps = {
  loginHref?: string;
};

const PRICING_PATHS = [
  {
    title: 'Global Tutor Plan',
    body: 'Affordable academic support from experienced tutors. Best for homework help, foundations, practice, and consistency. Starting from $12/hour.',
  },
  {
    title: 'USA Curriculum Plan',
    body: 'USA-based or native English-speaking tutors for ELA, writing, state standards, and school-specific expectations. Best for students in U.S. schools.',
  },
  {
    title: 'Advanced & Enrichment Plan',
    body: 'Specialized tutors for coding, robotics, debate, chess, music, competition prep, and advanced academics. Best for students ready to move ahead.',
  },
  {
    title: 'Custom Learning Plan',
    body: 'For families who need multiple subjects, sibling support, flexible scheduling, or a long-term academic path.',
  },
] as const;

const DIFFERENTIATORS = [
  'Regional educator matching instead of one generic tutor pool',
  'Options for both affordable global tutoring and USA-based instruction',
  'Curriculum coverage aligned to school goals and state standards where applicable',
  'Support across academics, enrichment, test prep, coding, debate, chess, and STEM',
  'Flexible scheduling for families working across countries and time zones',
  'Parent-visible learning progress and program guidance before long-term commitments',
] as const;

export function MarketingPricingPage({
  loginHref = '/iconic-academy/get-started',
}: MarketingPricingPageProps) {
  return (
    <div className="bg-background text-foreground">
      <section className={MARKETING_HERO_BAND_CLASS}>
        <div className={MARKETING_LEAD_CONTAINER_CLASS}>
          <p className="text-sm font-semibold uppercase text-primary">Pricing</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-normal sm:text-5xl">
            Flexible tutoring options for every family
          </h1>
          <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
            ICONIC Academy pricing depends on program type, educator match, frequency,
            region, curriculum needs, and student goals. Class sessions start from
            $12/hour, with global tutor options and USA-based specialists available for
            state standards, language-heavy subjects, and advanced learning needs.
          </p>
        </div>
      </section>

      <section className={MARKETING_SECTION_CLASS}>
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2">
          {PRICING_PATHS.map((item) => (
            <article key={item.title} className={MARKETING_CARD_CLASS}>
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>

        <div
          className={`mx-auto mt-10 grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] ${MARKETING_ACTION_CARD_CLASS}`}
        >
          <div>
            <p className="text-sm font-semibold uppercase text-primary">
              What makes us different
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              Regional specialization without losing global flexibility
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Many tutoring marketplaces optimize for quick booking. ICONIC Academy
              focuses on fit: the right educator background, curriculum familiarity,
              language exposure, regional expertise, and level of academic challenge for
              each learner.
            </p>
          </div>
          <ul className="grid gap-3">
            {DIFFERENTIATORS.map((item) => (
              <li key={item} className={MARKETING_INSET_CARD_CLASS}>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div
          className={`mx-auto mt-10 flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${MARKETING_ACTION_CARD_CLASS}`}
        >
          <div>
            <p className="text-lg font-semibold">Request program details</p>
            <p className="text-sm text-muted-foreground">
              Sign in or get started so the team can recommend tutor options by budget,
              learner goals, curriculum needs, language needs, and regional expertise.
            </p>
          </div>
          <a
            href={loginHref}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Request details
          </a>
        </div>
      </section>
      <MarketingLowFrictionStartSection loginHref={loginHref} />
    </div>
  );
}
