import { MARKETING_CONTACT_DETAILS } from './marketing.constants';

type MarketingContactPageProps = {
  loginHref?: string;
};

export function MarketingContactPage({
  loginHref = '/iconic-academy/login',
}: MarketingContactPageProps) {
  return (
    <div className="bg-background text-foreground">
      <section className="border-b border-border/60 bg-emerald-50/60 px-4 py-16 dark:bg-emerald-950/20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase text-primary">Contact</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-normal sm:text-5xl">
            Talk with ICONIC Academy
          </h1>
          <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
            Reach out about tutoring programs, USA-based or global tutor options,
            curriculum needs, advanced learner support, educator opportunities, or account
            support.
          </p>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
          {[
            {
              title: 'Program inquiries',
              body: 'Ask about tutoring, full-curriculum support, enrichment, test prep, state standards, or regional program options.',
              href: 'mailto:hello@iconicedu.com?subject=Program%20inquiry',
              label: 'hello@iconicedu.com',
            },
            {
              title: 'Family support',
              body: 'Get help with sign-in, scheduling, or learner account questions.',
              href: loginHref,
              label: 'Open family portal',
            },
            {
              title: 'Educator interest',
              body: 'Learn how experienced USA-based and global educators can connect with ICONIC Academy.',
              href: 'mailto:hello@iconicedu.com?subject=Educator%20interest',
              label: 'Contact our team',
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-lg border border-border/70 bg-card px-6 py-5 shadow-sm"
            >
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <p className="mt-3 min-h-20 text-sm leading-7 text-muted-foreground">
                {item.body}
              </p>
              <a
                href={item.href}
                className="mt-5 inline-flex min-h-10 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold transition hover:bg-muted"
              >
                {item.label}
              </a>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-8 grid max-w-5xl gap-5 rounded-lg border border-border/70 bg-card px-6 py-6 shadow-sm md:grid-cols-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-foreground/70">
              Call
            </p>
            <a
              href={MARKETING_CONTACT_DETAILS.phone.href}
              className="mt-2 inline-flex text-base font-semibold text-foreground transition hover:text-primary"
            >
              {MARKETING_CONTACT_DETAILS.phone.label}
            </a>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-foreground/70">
              WhatsApp
            </p>
            <a
              href={MARKETING_CONTACT_DETAILS.whatsapp.href}
              className="mt-2 inline-flex text-base font-semibold text-foreground transition hover:text-primary"
            >
              {MARKETING_CONTACT_DETAILS.whatsapp.label}
            </a>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-foreground/70">
              Locations
            </p>
            <p className="mt-2 text-base font-semibold text-foreground">
              {MARKETING_CONTACT_DETAILS.locations.join(' · ')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
