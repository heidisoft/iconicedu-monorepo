import { MOBILE_APP_LINKS } from './marketing.constants';

type StoreBadgeSize = 'default' | 'compact';
type StoreBadgeLayout = 'inline' | 'stacked';

type StoreBadgeProps = {
  link: (typeof MOBILE_APP_LINKS)[number];
  size?: StoreBadgeSize;
};

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M16.24 1.55c.08 1.04-.31 2.05-1.01 2.8-.72.78-1.86 1.37-2.87 1.29-.1-1 .34-2.05.98-2.75.72-.8 1.98-1.41 2.9-1.34Zm3.55 16.3c-.54 1.24-.8 1.8-1.5 2.9-.98 1.5-2.35 3.38-4.06 3.4-.78 0-1.3-.22-1.84-.46-.57-.25-1.17-.51-2.11-.51-.96 0-1.59.27-2.18.52-.55.24-1.08.47-1.84.45-1.7-.02-3.01-1.7-3.99-3.21-2.74-4.23-3.03-9.17-1.34-11.8 1.2-1.88 3.1-2.97 4.88-2.97.9 0 1.63.3 2.3.58.62.25 1.2.49 1.78.49.55 0 1.08-.23 1.69-.49.76-.32 1.64-.69 2.75-.69 1.58 0 3.25.86 4.45 2.35-3.9 2.15-3.27 7.73 1.01 9.44Z"
      />
    </svg>
  );
}

function GooglePlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="#00A0FF"
        d="M3.35 2.5c-.22.25-.35.63-.35 1.12v16.76c0 .49.13.87.35 1.12L12.82 12 3.35 2.5Z"
      />
      <path
        fill="#00F076"
        d="m15.98 8.83-11.87-6.7c-.31-.18-.59-.22-.76-.1L12.82 12l3.16-3.17Z"
      />
      <path
        fill="#FFCE00"
        d="m15.98 15.17-3.16-3.17-9.47 9.97c.17.12.45.08.76-.1l11.87-6.7Z"
      />
      <path
        fill="#FF3D00"
        d="m20.58 10.6-4.6-1.77L12.82 12l3.16 3.17 4.6-1.77c.9-.52.9-2.28 0-2.8Z"
      />
    </svg>
  );
}

function StoreIcon({
  shortLabel,
  className,
}: {
  shortLabel: string;
  className?: string;
}) {
  return shortLabel === 'App Store' ? (
    <AppleIcon className={className} />
  ) : (
    <GooglePlayIcon className={className} />
  );
}

export function MarketingStoreBadge({ link, size = 'default' }: StoreBadgeProps) {
  const compact = size === 'compact';

  return (
    <a
      href={link.href}
      target="_blank"
      rel="noreferrer"
      aria-label={link.label}
      className={[
        'inline-flex items-center rounded-lg bg-black text-white shadow-sm ring-1 ring-white/15 transition hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        compact ? 'min-h-9 gap-1.5 px-2.5 py-1.5' : 'min-h-14 gap-3 px-4 py-2.5',
      ].join(' ')}
    >
      <StoreIcon
        shortLabel={link.shortLabel}
        className={compact ? 'size-4 shrink-0' : 'size-7 shrink-0'}
      />
      <span className="grid text-left leading-none">
        <span className={compact ? 'text-[0.48rem]' : 'text-[0.65rem]'}>
          {link.shortLabel === 'App Store' ? 'Download on the' : 'Get it on'}
        </span>
        <span className={compact ? 'text-xs font-semibold' : 'text-lg font-semibold'}>
          {link.shortLabel}
        </span>
      </span>
    </a>
  );
}

export function MarketingStoreBadges({
  size = 'default',
  layout = 'stacked',
}: {
  size?: StoreBadgeSize;
  layout?: StoreBadgeLayout;
}) {
  return (
    <div
      className={
        layout === 'inline'
          ? 'flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap'
          : 'flex flex-col items-start gap-3'
      }
    >
      {MOBILE_APP_LINKS.map((link) => (
        <MarketingStoreBadge key={link.href} link={link} size={size} />
      ))}
    </div>
  );
}
