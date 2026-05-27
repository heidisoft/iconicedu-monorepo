import { FOOTER_LINK_GROUPS, MARKETING_CONTACT_DETAILS } from './marketing.constants';
import { MarketingStoreBadges } from './marketing-store-badges';

type MarketingFooterSectionProps = {
  loginHref?: string;
};

export function MarketingFooterSection({
  loginHref = '/iconic-academy/login',
}: MarketingFooterSectionProps) {
  return (
    <footer id="about" className="border-t border-border/60 bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-lg font-semibold">ICONIC Academy</p>
            <p className="mt-2 text-sm text-foreground/75">
              Elite 1-on-1 education designed for measurable academic success. Where
              strong foundations create brighter futures.
            </p>
            <address className="mt-4 space-y-1 text-sm not-italic text-foreground/75">
              <p>{MARKETING_CONTACT_DETAILS.locations.join(' · ')}</p>
              <p>
                <a
                  href={MARKETING_CONTACT_DETAILS.phone.href}
                  className="transition hover:text-foreground"
                >
                  {MARKETING_CONTACT_DETAILS.phone.label}
                </a>
              </p>
              <p>
                WhatsApp:{' '}
                <a
                  href={MARKETING_CONTACT_DETAILS.whatsapp.href}
                  className="transition hover:text-foreground"
                >
                  {MARKETING_CONTACT_DETAILS.whatsapp.label}
                </a>
              </p>
            </address>
            <div className="mt-4">
              <MarketingStoreBadges />
            </div>
          </div>
          {FOOTER_LINK_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-semibold uppercase tracking-wide text-foreground/70">
                {group.title}
              </p>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.label === 'Become a Tutor' ? loginHref : link.href}
                      className="text-sm text-foreground/80 transition hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-10 text-xs text-foreground/60">
          © {new Date().getFullYear()} ICONIC Academy. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
