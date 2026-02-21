import { LEARNING_AREAS } from './marketing.constants';

export function MarketingSubjectsSection() {
  return (
    <section id="subjects" className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3 overflow-x-auto rounded-[2rem] bg-secondary/20 px-4 py-4 sm:px-6">
        {LEARNING_AREAS.map((area) => (
          <div
            key={area}
            className="shrink-0 rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-semibold text-card-foreground"
          >
            {area}
          </div>
        ))}
        <span className="ml-auto inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xl">
          ›
        </span>
      </div>
    </section>
  );
}
