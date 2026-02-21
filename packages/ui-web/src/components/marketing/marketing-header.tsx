import { Button } from '@iconicedu/ui-web/ui/button';
import { SiteLogoWithName } from '@iconicedu/ui-web/components/branding/site-logo-wt-name';

const NAV_ITEMS = [
  { label: 'Home', href: '#home' },
  { label: 'Subjects', href: '#subjects' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'For Parents', href: '#for-parents' },
  { label: 'About', href: '#about' },
] as const;

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <a href="/" className="flex items-center gap-2 text-xl font-bold">
          <SiteLogoWithName />
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

        <Button asChild className="rounded-full px-6">
          <a href="/login">Get Started</a>
        </Button>
      </nav>
    </header>
  );
}
