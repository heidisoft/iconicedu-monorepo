import { Button } from '@iconicedu/ui-web/ui/button';
import { SiteLogoFull } from '@iconicedu/ui-web/components/branding/site-logo-full';
import { ThemeToggle } from '@iconicedu/ui-web/components/theme-toggle';
import { Menu } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Programs', href: '/programs' },
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'For Parents', href: '/for-parents' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Contact', href: '/contact' },
] as const;

type MarketingHeaderProps = {
  isAuthenticated?: boolean;
  loginHref?: string;
  dashboardHref?: string;
};

export function MarketingHeader({
  isAuthenticated = false,
  loginHref = '/iconic-academy/login',
  dashboardHref = '/get-started',
}: MarketingHeaderProps) {
  const ctaLabel = isAuthenticated ? 'Dashboard' : 'Log In';
  const ctaHref = isAuthenticated ? dashboardHref : loginHref;

  return (
    <header className="sticky top-0 z-50 border-b border-emerald-100/70 bg-emerald-50/70 backdrop-blur dark:border-emerald-800/55 dark:bg-emerald-950/30">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <a href="/" className="flex items-center gap-2 text-xl font-bold text-foreground">
          <span className="flex items-center justify-center rounded-lg">
            <SiteLogoFull className="h-10 w-auto sm:h-12" />
          </span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-foreground transition-colors hover:text-primary"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={'outline'}
            asChild
            className="rounded-full px-4 bg-transparent border-emerald-500/70 text-emerald-700 hover:bg-emerald-100/70 hover:border-emerald-500 sm:px-6"
          >
            <a href={ctaHref}>{ctaLabel}</a>
          </Button>
          <ThemeToggle />
          <details className="group relative md:hidden">
            <summary
              aria-label="Open menu"
              className="inline-flex size-9 cursor-pointer list-none items-center justify-center rounded-4xl border border-emerald-500/70 bg-transparent text-emerald-700 transition-colors hover:border-emerald-500 hover:bg-emerald-100/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden"
            >
              <Menu className="size-4" aria-hidden="true" />
            </summary>
            <div className="absolute right-0 top-12 w-56 overflow-hidden rounded-2xl border border-emerald-100/80 bg-background shadow-lg ring-1 ring-black/5 dark:border-emerald-800/60">
              <div className="flex flex-col py-2">
                {NAV_ITEMS.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-emerald-50 hover:text-primary dark:hover:bg-emerald-950/50"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
}
