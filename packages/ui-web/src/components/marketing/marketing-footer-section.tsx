import { FOOTER_LINK_GROUPS } from './marketing.constants';

export function MarketingFooterSection() {
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
                      href={link.href}
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
