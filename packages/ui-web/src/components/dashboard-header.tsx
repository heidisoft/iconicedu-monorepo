'use client';
import { useIsMobile } from '@iconicedu/ui-web/hooks/use-mobile';
import { Separator } from '@iconicedu/ui-web/ui/separator';
import { SidebarTrigger } from '@iconicedu/ui-web/ui/sidebar';
import { SiteLogo } from '@iconicedu/ui-web/components/branding/site-logo';
import { ThemeToggle } from '@iconicedu/ui-web/components/theme-toggle';

type DashboardHeaderProps = React.ComponentProps<'div'> & {
  title?: string;
  description?: string;
};

export function DashboardHeader({
  className: _className,
  title,
  description,
  ..._props
}: DashboardHeaderProps) {
  const isMobile = useIsMobile();
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-end px-4 lg:gap-2 lg:px-6">
        <div className="flex flex-1 items-center gap-1">
          <SidebarTrigger className="-ml-1 size-9 hover:text-primary" />
          {title && (
            <>
              <Separator orientation="vertical" className="m-2" />
              <h1 className="text-base font-medium">{title}</h1>
              {description ? (
                <p className="text-xs text-muted-foreground hidden lg:block">
                  {description}
                </p>
              ) : null}
            </>
          )}
        </div>
        {isMobile && (
          <div className="flex text-center gap-1">
            <SiteLogo className="border-0" />
          </div>
        )}
        <div className="ml-auto flex flex-1 items-center justify-end gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
