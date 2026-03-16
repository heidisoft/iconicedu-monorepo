import { TRUST_STATS } from './marketing.constants';

export function MarketingTrustStatsSection() {
  return (
    <section id="for-parents" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-4 sm:grid-cols-3">
        {TRUST_STATS.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-border/60 bg-card p-5"
          >
            <p className="text-2xl font-bold text-primary">{item.value}</p>
            <p className="mt-1 text-sm text-card-foreground/80">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
