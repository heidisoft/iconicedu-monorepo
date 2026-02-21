import { SiteLogo } from '@iconicedu/ui-web/components/branding/site-logo';
import { cn } from '@iconicedu/ui-web/lib/utils';

export function SiteLogoWithName({ className }: { className?: string }) {
  return (
    <>
      {/* <SiteLogo className="border-0" /> */}
      <div className="size-8 flex aspect-square items-center justify-center rounded-xl">
        <SiteLogo className={cn('!size-8', className)} />
      </div>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">ICONIC Academy</span>
        <span className="truncate text-xs">Turn effort into outcomes</span>
      </div>
    </>
  );
}
