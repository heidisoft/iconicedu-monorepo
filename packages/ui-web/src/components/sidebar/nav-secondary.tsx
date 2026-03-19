import * as React from 'react';
import type { SidebarSecondaryItem } from '@iconicedu/shared-types';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@iconicedu/ui-web/ui/sidebar';

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
              <SidebarMenuButton
                asChild
                size="sm"
                isActive={item.isActive}
                className={
                  isSupportItem
                    ? 'bg-amber-50/85 text-amber-700 ring-1 ring-inset ring-amber-300/70 hover:bg-amber-100/85 hover:text-amber-800 data-active:bg-amber-100 data-active:text-amber-900 dark:bg-amber-500/12 dark:text-amber-200 dark:ring-amber-400/45 dark:hover:bg-amber-500/20 dark:hover:text-amber-100 dark:data-active:bg-amber-500/25'
                    : undefined
                }
              >
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

            return <SidebarMenuItem key={item.title}>{content}</SidebarMenuItem>;
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
