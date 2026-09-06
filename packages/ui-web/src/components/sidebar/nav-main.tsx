'use client';

import type { SidebarNavItem } from '@iconicedu/shared-types';

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@iconicedu/ui-web/ui/sidebar';
import { cn } from '@iconicedu/ui-web/lib/utils';

export function NavMain({ items }: { items: SidebarNavItem[] }) {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild isActive={item.isActive}>
              <a href={item.url}>
                <item.icon className={cn(item.color)} />
                <span>{item.title}</span>
              </a>
            </SidebarMenuButton>
            {item.count && (
              <SidebarMenuBadge className="px-1.5 text-[10px] bg-destructive text-white peer-hover/menu-button:text-white peer-data-active/menu-button:text-white">
                {item.count}
              </SidebarMenuBadge>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
