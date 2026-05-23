import { MISSION_PILLARS } from './marketing.constants';

export function MarketingMissionSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase text-primary">
            Why families choose us
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-normal">
            Trustworthy, parent-friendly learning that stays within reach
          </h2>
          <p className="mt-4 text-foreground/75">
            ICONIC Academy is professional but not corporate: warm with students,
            practical with parents, and mission-driven about making quality education more
            accessible.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {MISSION_PILLARS.map((pillar) => (
            <article
              key={pillar.title}
              className="rounded-lg border border-border/70 bg-card px-5 py-5 shadow-sm"
            >
              <h3 className="text-lg font-semibold">{pillar.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {pillar.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
