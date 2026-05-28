import { CalendarCheck, HelpCircle, PhoneCall } from 'lucide-react';
import { MARKETING_PANEL_CLASS, MARKETING_SECTION_CLASS } from './marketing-layout';

type MarketingLowFrictionStartSectionProps = {
  loginHref?: string;
};

const START_OPTIONS = [
  {
    title: 'Request a free trial class',
    body: 'Start with a low-commitment class to check tutor fit, teaching style, and schedule.',
    cta: 'Request free trial class',
    icon: CalendarCheck,
  },
  {
    title: 'Book a free learning match call',
    body: 'Talk through curriculum, goals, budget, and schedule before regular tutoring starts.',
    cta: 'Book free call',
    icon: PhoneCall,
  },
  {
    title: 'Need homework help this week?',
    body: 'Share the assignment, deadline, topic, and availability so staff can check same-week support where available.',
    cta: 'Ask for same-week help',
    icon: HelpCircle,
  },
] as const;

export function MarketingLowFrictionStartSection({
  loginHref = '/iconic-academy/get-started',
}: MarketingLowFrictionStartSectionProps) {
  return (
    <section className={MARKETING_SECTION_CLASS}>
      <div className={`${MARKETING_PANEL_CLASS} bg-emerald-50/50 dark:bg-emerald-950/20`}>
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase text-primary">
            Easy ways to start
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-normal">
            Begin with the level of support that feels right
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Families can request a free trial class, start with a free learning match
            call, or ask for urgent homework help before choosing a regular tutoring plan.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {START_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <article
                key={option.title}
                className="rounded-2xl border border-border/70 bg-background px-6 py-6 shadow-sm"
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-xl font-semibold">{option.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {option.body}
                </p>
                <a
                  href={loginHref}
                  className="mt-5 inline-flex min-h-10 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-semibold transition hover:bg-muted"
                >
                  {option.cta}
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
