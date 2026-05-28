import { MarketingStoreBadges } from './marketing-store-badges';
import { MARKETING_PANEL_CLASS, MARKETING_SECTION_CLASS } from './marketing-layout';

const MOBILE_SCREENSHOTS = [
  {
    src: '/marketing/mobile-home.png',
    alt: 'ICONIC Academy mobile app home screen showing upcoming sessions',
  },
  {
    src: '/marketing/mobile-messages.png',
    alt: 'ICONIC Academy mobile app messages screen showing tutor feedback',
  },
] as const;

function MobileScreenshotCard({ src, alt }: (typeof MOBILE_SCREENSHOTS)[number]) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-slate-50 shadow-sm">
      <img
        src={src}
        alt={alt}
        className="aspect-[9/16] h-auto w-full object-cover object-top"
        loading="lazy"
      />
    </div>
  );
}

export function MarketingMobileAppSection() {
  return (
    <section className={MARKETING_SECTION_CLASS}>
      <div
        className={`grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center ${MARKETING_PANEL_CLASS}`}
      >
        <div>
          <p className="text-sm font-semibold uppercase text-primary">Mobile apps</p>
          <h2 className="mt-3 text-3xl font-bold tracking-normal">
            Learning updates are easier to follow from anywhere
          </h2>
          <p className="mt-4 text-foreground/75">
            Families can use the ICONIC Academy mobile app to see upcoming sessions, join
            live classes, follow tutor messages, and keep track of learning updates
            between lessons.
          </p>
          <div className="mt-6">
            <MarketingStoreBadges layout="inline" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {MOBILE_SCREENSHOTS.map((screenshot) => (
            <MobileScreenshotCard key={screenshot.src} {...screenshot} />
          ))}
        </div>
      </div>
    </section>
  );
}
