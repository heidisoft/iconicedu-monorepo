import * as React from 'react';
import type { SidebarSecondaryItem } from '@iconicedu/shared-types';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@iconicedu/ui-web/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@iconicedu/ui-web/ui/tooltip';

export function NavSecondary({
  items,
  ...props
}: {
  items: SidebarSecondaryItem[];
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isSupportItem =
              item.title.toLowerCase().includes('support') ||
              item.url.toLowerCase().includes('/support');

            const content = (
              <SidebarMenuButton asChild size="sm" isActive={item.isActive}>
                <a href={item.url}>
                  <item.icon
                    className={
                      isSupportItem ? 'text-amber-500 dark:text-amber-400' : undefined
                    }
                  />
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            );

            return (
              <SidebarMenuItem key={item.title}>
                {isSupportItem ? (
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>{content}</TooltipTrigger>
                      <TooltipContent
                        side="right"
                        align="center"
                        className="max-w-xs text-xs leading-relaxed"
                      >
                        Ask us anything in real time: classes, schedules, reschedules,
                        cancellations, and payments.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  content
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
