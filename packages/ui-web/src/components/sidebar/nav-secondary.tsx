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
                    ? 'bg-warning/10 text-warning ring-1 ring-inset ring-warning/30 hover:bg-warning/15 data-active:bg-warning/20'
                    : undefined
                }
              >
                <a href={item.url}>
                  <item.icon className={isSupportItem ? 'text-warning' : undefined} />
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
