'use client';

import * as React from 'react';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@iconicedu/ui-web/ui/sidebar';
import {
  Activity,
  CalendarCheck,
  Layers,
  Shield,
  ShieldCheck,
  Sliders,
  Users,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@iconicedu/ui-web/lib/utils';
import type {
  AdminMenuIconKey,
  AdminMenuLinkVM,
  AdminMenuSectionVM,
} from '@iconicedu/shared-types';
export type { AdminMenuSectionVM };

const ADMIN_MENU_ICON_MAP: Record<
  AdminMenuIconKey,
  React.ComponentType<{ className?: string }>
> = {
  users: Users,
  learning_spaces: Layers,
  class_schedules: CalendarCheck,
  channels: Shield,
  activity: Activity,
  moderation: ShieldCheck,
  system: Sliders,
};

type NavAdminProps = {
  label?: string;
  sections: AdminMenuSectionVM[];
  activePath?: string | null;
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>;

export function NavAdmin({
  label = 'Administration',
  sections,
  activePath,
  ...props
}: NavAdminProps) {
  const getIsActive = React.useCallback(
    (url: string) =>
      activePath ? activePath === url || activePath.startsWith(url) : false,
    [activePath],
  );
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((section) => [section.title, false])),
  );
  const toggleSection = React.useCallback((title: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  }, []);

  React.useEffect(() => {
    setOpenSections((prev) => {
      let changed = false;
      const next = { ...prev };
      sections.forEach((section) => {
        const shouldBeOpen = section.links.some((link: AdminMenuLinkVM) =>
          getIsActive(link.url),
        );
        if (shouldBeOpen && !next[section.title]) {
          next[section.title] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [getIsActive, sections]);

  return (
    <SidebarGroup {...props}>
      <SidebarGroupLabel asChild className="uppercase">
        <span>{label}</span>
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {sections.map((section) => {
            const sectionIsActive = section.links.some((link: AdminMenuLinkVM) =>
              getIsActive(link.url),
            );
            const sectionIsOpen = openSections[section.title] ?? false;
            const Icon = ADMIN_MENU_ICON_MAP[section.iconKey] ?? Users;
            return (
              <SidebarMenuItem key={section.title}>
                <SidebarMenuButton
                  type="button"
                  isActive={sectionIsActive}
                  data-open={sectionIsOpen ? 'true' : 'false'}
                  aria-expanded={sectionIsOpen}
                  onClick={() => toggleSection(section.title)}
                >
                  <Icon className="size-4" />
                  <span>{section.title}</span>
                  <ChevronDown
                    className={cn(
                      'ml-auto transition-transform duration-200 ease-in',
                      sectionIsOpen ? 'rotate-180' : 'rotate-0',
                    )}
                  />
                </SidebarMenuButton>
                {sectionIsOpen && (
                  <SidebarMenuSub>
                    {section.links.map((link: AdminMenuLinkVM) => (
                      <SidebarMenuSubItem key={link.title}>
                        <SidebarMenuSubButton
                          asChild
                          size="md"
                          isActive={getIsActive(link.url)}
                        >
                          <a href={link.url}>{link.title}</a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
