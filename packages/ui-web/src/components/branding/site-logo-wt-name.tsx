import { SiteLogo } from '@iconicedu/ui-web/components/branding/site-logo';
import { cn } from '@iconicedu/ui-web/lib/utils';

export function SiteLogoWithName({ className }: { className?: string }) {
  return (
    <>
      {/* <SiteLogo className="border-0" /> */}
      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl group-data-[collapsible=icon]:mx-auto">
        <SiteLogo className={cn('!size-8', className)} />
      </div>
      <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
        <span className="truncate font-medium">ICONIC Academy</span>
        <span className="truncate text-xs">Turn effort into outcomes</span>
      </div>
    </>
  );
}
